import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import { query, initDb } from './db.js';
import { signToken, requireAuth, requireAdmin } from './auth.js';
import { analyticsRouter } from './analytics.js';

const app = express();
app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:5173' }));
app.use(express.json({ limit: '1mb' }));

const wrap = (fn) => (req, res, next) => fn(req, res, next).catch(next);
const publicUser = (u) => ({ id: u.id, name: u.name, email: u.email, role: u.role, phone: u.phone || '', address: u.address || '', avatar: u.avatar || '' });

app.use('/api/admin/analytics', requireAuth, requireAdmin, analyticsRouter);

// ---------- Auth ----------
app.post('/api/auth/register', wrap(async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password)
    return res.status(400).json({ error: 'Name, email and password are required' });
  if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });
  if (/\s/.test(password)) return res.status(400).json({ error: 'Password must not contain spaces' });
  if (!/[A-Z]/.test(password)) return res.status(400).json({ error: 'Password needs at least one uppercase letter' });
  if (!/[^A-Za-z0-9]/.test(password)) return res.status(400).json({ error: 'Password needs at least one special symbol (e.g. ! @ # $)' });
  const hash = await bcrypt.hash(password, 10);
  try {
    const { rows } = await query(
      "INSERT INTO users (name,email,password_hash,role) VALUES ($1,$2,$3,'customer') RETURNING *",
      [name.trim(), email.trim().toLowerCase(), hash]);
    res.status(201).json({ token: signToken(rows[0]), user: publicUser(rows[0]) });
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ error: 'Email already registered' });
    throw e;
  }
}));

app.post('/api/auth/login', wrap(async (req, res) => {
  const { email, password } = req.body;
  const { rows } = await query('SELECT * FROM users WHERE email=$1', [(email || '').trim().toLowerCase()]);
  const u = rows[0];
  if (!u || !(await bcrypt.compare(password || '', u.password_hash)))
    return res.status(401).json({ error: 'Invalid email or password' });
  res.json({ token: signToken(u), user: publicUser(u) });
}));

app.get('/api/auth/me', requireAuth, wrap(async (req, res) => {
  const { rows } = await query('SELECT * FROM users WHERE id=$1', [req.user.id]);
  if (!rows[0]) return res.status(401).json({ error: 'User no longer exists' });
  res.json({ user: publicUser(rows[0]) });
}));

// ---------- Contact form (public) ----------
const contactHits = new Map(); // ip -> timestamps, max 5 messages per hour
app.post('/api/contact', wrap(async (req, res) => {
  const name = (req.body.name || '').trim();
  const email = (req.body.email || '').trim().toLowerCase();
  const phone = (req.body.phone || '').replace(/[\s-]/g, '');
  const message = (req.body.message || '').trim();
  if (!name || !email || !message) return res.status(400).json({ error: 'Name, email and message are required' });
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return res.status(400).json({ error: 'Enter a valid email address' });
  if (phone && !/^\+?\d{7,15}$/.test(phone)) return res.status(400).json({ error: 'Enter a valid phone number' });
  if (name.length > 100 || message.length > 2000) return res.status(400).json({ error: 'Name or message is too long' });
  const now = Date.now();
  const hits = (contactHits.get(req.ip) || []).filter((t) => now - t < 3600000);
  if (hits.length >= 5) return res.status(429).json({ error: 'Too many messages. Please try again later.' });
  contactHits.set(req.ip, [...hits, now]);
  await query('INSERT INTO contact_messages (name,email,phone,message) VALUES ($1,$2,$3,$4)', [name, email, phone, message]);
  await notifyAdmins(`New message from ${name}: "${message.slice(0, 60)}${message.length > 60 ? '…' : ''}"`);
  res.status(201).json({ ok: true });
}));

app.get('/api/admin/messages', requireAuth, requireAdmin, wrap(async (req, res) => {
  const { rows } = await query('SELECT * FROM contact_messages ORDER BY created_at DESC LIMIT 200');
  res.json(rows);
}));
app.patch('/api/admin/messages/:id/read', requireAuth, requireAdmin, wrap(async (req, res) => {
  await query('UPDATE contact_messages SET read=$1 WHERE id=$2', [req.body.read !== false, req.params.id]);
  res.json({ ok: true });
}));
app.delete('/api/admin/messages/:id', requireAuth, requireAdmin, wrap(async (req, res) => {
  await query('DELETE FROM contact_messages WHERE id=$1', [req.params.id]);
  res.json({ ok: true });
}));

// ---------- Profile ----------
app.put('/api/profile', requireAuth, wrap(async (req, res) => {
  const name = (req.body.name || '').trim();
  const email = (req.body.email || '').trim().toLowerCase();
  const phone = (req.body.phone || '').replace(/[\s-]/g, '');
  const address = (req.body.address || '').trim();
  if (!name) return res.status(400).json({ error: 'Name is required' });
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return res.status(400).json({ error: 'Enter a valid email address' });
  if (phone && !/^\+?\d{7,15}$/.test(phone)) return res.status(400).json({ error: 'Enter a valid phone number (7–15 digits, e.g. +639171234567)' });
  try {
    const { rows } = await query(
      'UPDATE users SET name=$1, email=$2, phone=$3, address=$4 WHERE id=$5 RETURNING *',
      [name, email, phone, address, req.user.id]);
    res.json({ user: publicUser(rows[0]) });
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ error: 'That email is already used by another account' });
    throw e;
  }
}));

app.put('/api/profile/avatar', requireAuth, wrap(async (req, res) => {
  const avatar = req.body.avatar || '';
  if (avatar && (!/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(avatar) || avatar.length > 400000))
    return res.status(400).json({ error: 'Please upload a JPG, PNG or WebP image (max about 300 KB after resizing)' });
  const { rows } = await query('UPDATE users SET avatar=$1 WHERE id=$2 RETURNING *', [avatar, req.user.id]);
  res.json({ user: publicUser(rows[0]) });
}));

// ---------- Services ----------
app.get('/api/services', wrap(async (req, res) => {
  const { rows } = await query('SELECT * FROM services WHERE active ORDER BY id');
  res.json(rows);
}));

app.get('/api/admin/services', requireAuth, requireAdmin, wrap(async (req, res) => {
  const { rows } = await query('SELECT * FROM services ORDER BY id');
  res.json(rows);
}));

app.post('/api/admin/services', requireAuth, requireAdmin, wrap(async (req, res) => {
  const { name, description = '', price = 0 } = req.body;
  if (!name) return res.status(400).json({ error: 'Name required' });
  const { rows } = await query(
    'INSERT INTO services (name,description,price) VALUES ($1,$2,$3) RETURNING *', [name, description, price]);
  res.status(201).json(rows[0]);
}));

app.put('/api/admin/services/:id', requireAuth, requireAdmin, wrap(async (req, res) => {
  const { name, description, price, active } = req.body;
  const { rows } = await query(
    `UPDATE services SET name=COALESCE($1,name), description=COALESCE($2,description),
     price=COALESCE($3,price), active=COALESCE($4,active) WHERE id=$5 RETURNING *`,
    [name, description, price, active, req.params.id]);
  if (!rows[0]) return res.status(404).json({ error: 'Not found' });
  res.json(rows[0]);
}));

// ---------- Notifications ----------
const notify = (userId, message) =>
  query('INSERT INTO notifications (user_id,message) VALUES ($1,$2)', [userId, message]);
const notifyAdmins = (message) =>
  query("INSERT INTO notifications (user_id,message) SELECT id,$1 FROM users WHERE role='admin'", [message]);

app.get('/api/notifications', requireAuth, wrap(async (req, res) => {
  const { rows } = await query(
    'SELECT * FROM notifications WHERE user_id=$1 ORDER BY created_at DESC LIMIT 30', [req.user.id]);
  res.json(rows);
}));

app.post('/api/notifications/read-all', requireAuth, wrap(async (req, res) => {
  await query('UPDATE notifications SET read=TRUE WHERE user_id=$1', [req.user.id]);
  res.json({ ok: true });
}));

app.patch('/api/notifications/:id/read', requireAuth, wrap(async (req, res) => {
  await query('UPDATE notifications SET read=TRUE WHERE id=$1 AND user_id=$2', [req.params.id, req.user.id]);
  res.json({ ok: true });
}));

// ---------- Bookings (customer) ----------
const BOOKING_SELECT = `
  SELECT b.*, s.name AS service_name, s.price::float AS price, u.name AS customer_name, u.email AS customer_email
  FROM bookings b JOIN services s ON s.id=b.service_id JOIN users u ON u.id=b.user_id`;

app.post('/api/bookings', requireAuth, wrap(async (req, res) => {
  const { service_id, address, phone, scheduled_at, notes = '' } = req.body;
  if (!service_id || !address || !phone || !scheduled_at || isNaN(Date.parse(scheduled_at)))
    return res.status(400).json({ error: 'Service, address, phone and a valid date are required' });
  if (new Date(scheduled_at) < new Date())
    return res.status(400).json({ error: 'Date must be in the future' });
  const svc = await query('SELECT id FROM services WHERE id=$1 AND active', [service_id]);
  if (!svc.rows[0]) return res.status(400).json({ error: 'Invalid service' });
  const { rows } = await query(
    `INSERT INTO bookings (user_id,service_id,address,phone,scheduled_at,notes)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
    [req.user.id, service_id, address, phone, scheduled_at, notes]);
  const full = await query(`${BOOKING_SELECT} WHERE b.id=$1`, [rows[0].id]);
  const b = full.rows[0];
  await notify(req.user.id, `Your booking for ${b.service_name} was submitted and is awaiting confirmation.`);
  await notifyAdmins(`New booking #${b.id}: ${b.customer_name} booked ${b.service_name}.`);
  res.status(201).json(b);
}));

app.get('/api/bookings/mine', requireAuth, wrap(async (req, res) => {
  const { rows } = await query(`${BOOKING_SELECT} WHERE b.user_id=$1 ORDER BY b.scheduled_at DESC`, [req.user.id]);
  res.json(rows);
}));

app.patch('/api/bookings/:id/cancel', requireAuth, wrap(async (req, res) => {
  const { rows } = await query(
    `UPDATE bookings SET status='cancelled' WHERE id=$1 AND user_id=$2 AND status IN ('pending','confirmed') RETURNING id`,
    [req.params.id, req.user.id]);
  if (!rows[0]) return res.status(404).json({ error: 'Booking not found or cannot be cancelled' });
  await notifyAdmins(`Booking #${rows[0].id} was cancelled by the customer.`);
  res.json({ ok: true });
}));

// ---------- Admin ----------
app.get('/api/admin/bookings', requireAuth, requireAdmin, wrap(async (req, res) => {
  const { rows } = await query(`${BOOKING_SELECT} ORDER BY b.created_at DESC`);
  res.json(rows);
}));

app.patch('/api/admin/bookings/:id', requireAuth, requireAdmin, wrap(async (req, res) => {
  const { status } = req.body;
  if (!['pending', 'confirmed', 'completed', 'cancelled'].includes(status))
    return res.status(400).json({ error: 'Invalid status' });
  const { rows } = await query('UPDATE bookings SET status=$1 WHERE id=$2 RETURNING id, user_id', [status, req.params.id]);
  if (!rows[0]) return res.status(404).json({ error: 'Not found' });
  if (status === 'completed') {
    // record the payment so new completed jobs flow into the analytics
    await query(
      `INSERT INTO payments (booking_id, amount, method)
       SELECT b.id, s.price, 'Cash' FROM bookings b JOIN services s ON s.id=b.service_id WHERE b.id=$1
       ON CONFLICT (booking_id) DO NOTHING`, [rows[0].id]);
  }
  await notify(rows[0].user_id, `Your booking #${rows[0].id} is now ${status}.`);
  res.json({ ok: true });
}));

app.get('/api/admin/users', requireAuth, requireAdmin, wrap(async (req, res) => {
  const { rows } = await query(
    `SELECT u.id,u.name,u.email,u.phone,u.address,u.role,u.created_at,
       (SELECT COUNT(*)::int FROM bookings b WHERE b.user_id=u.id) AS bookings
     FROM users u ORDER BY u.created_at DESC`);
  res.json(rows);
}));

app.get('/api/admin/stats', requireAuth, requireAdmin, wrap(async (req, res) => {
  const { rows } = await query(`
    SELECT
      (SELECT COUNT(*)::int FROM users WHERE role='customer') AS customers,
      COUNT(b.id)::int AS bookings,
      COUNT(*) FILTER (WHERE b.status='pending')::int AS pending,
      COALESCE(SUM(s.price) FILTER (WHERE b.status='completed'),0)::float AS revenue
    FROM bookings b JOIN services s ON s.id=b.service_id`);
  res.json(rows[0]);
}));

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Server error' });
});

const port = process.env.PORT || 5000;
initDb()
  .then(() => app.listen(port, () => console.log(`API running on http://localhost:${port}`)))
  .catch((e) => {
    console.error('DB init failed:', e.message);
    if (/ep-xxxx|ENOTFOUND/.test(e.message))
      console.error('\n>>> Open backend/.env and paste your real Neon connection string into DATABASE_URL (console.neon.tech -> Connect).\n');
    process.exit(1);
  });

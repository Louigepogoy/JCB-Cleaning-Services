// Fills the Neon database with sample customers, bookings and notifications.
// Run: npm run seed   (safe to run again; it skips data that already exists)
import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { query, initDb, pool } from './db.js';

const CUSTOMERS = [
  ['Maria Santos', 'maria@example.com'],
  ['Juan Dela Cruz', 'juan@example.com'],
  ['Ana Reyes', 'ana@example.com'],
  ['Carlo Mendoza', 'carlo@example.com'],
];

const day = (offset, hour = 9) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
};

// [customer index, service name, days from today, hour, address, phone, status, notes]
const BOOKINGS = [
  [0, 'House Cleaning', 3, 9, 'Lahug, Cebu City', '+639171112233', 'pending', 'Please bring your own supplies.'],
  [0, 'Carpet Cleaning', 10, 13, 'Lahug, Cebu City', '+639171112233', 'confirmed', ''],
  [0, 'Mattress Cleaning', -12, 10, 'Lahug, Cebu City', '+639171112233', 'completed', 'King size bed.'],
  [1, 'Commercial Cleaning', 5, 8, 'IT Park, Cebu City', '+639182223344', 'confirmed', 'Office, 2nd floor.'],
  [1, 'Hard Floor Cleaning', -20, 14, 'IT Park, Cebu City', '+639182223344', 'completed', ''],
  [2, 'Upholstery Cleaning', 7, 11, 'Mandaue City', '+639193334455', 'pending', '3-seater sofa and 4 chairs.'],
  [2, 'House Cleaning', -5, 9, 'Mandaue City', '+639193334455', 'cancelled', 'Rescheduling.'],
  [3, 'House Cleaning', 2, 15, 'Talisay City', '+639204445566', 'pending', ''],
  [3, 'Carpet Cleaning', -30, 10, 'Talisay City', '+639204445566', 'completed', ''],
];

await initDb();

const hash = await bcrypt.hash('Customer123!', 10);
const userIds = [];
for (const [name, email] of CUSTOMERS) {
  const { rows } = await query(
    `INSERT INTO users (name,email,password_hash,role) VALUES ($1,$2,$3,'customer')
     ON CONFLICT (email) DO UPDATE SET name=EXCLUDED.name RETURNING id`,
    [name, email, hash]);
  userIds.push(rows[0].id);
}

const { rows: services } = await query('SELECT id,name FROM services');
const svc = Object.fromEntries(services.map((s) => [s.name, s.id]));

let added = 0;
for (const [ci, service, offset, hour, address, phone, status, notes] of BOOKINGS) {
  if (!svc[service]) continue;
  const when = day(offset, hour);
  const dup = await query(
    'SELECT 1 FROM bookings WHERE user_id=$1 AND service_id=$2 AND scheduled_at=$3', [userIds[ci], svc[service], when]);
  if (dup.rows.length) continue;
  await query(
    `INSERT INTO bookings (user_id,service_id,address,phone,scheduled_at,notes,status)
     VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [userIds[ci], svc[service], address, phone, when, notes, status]);
  added++;
}

const { rows: n } = await query('SELECT COUNT(*)::int AS c FROM notifications');
if (n[0].c === 0) {
  await query(
    "INSERT INTO notifications (user_id,message) SELECT id,'Welcome to JCB Cleaning Services!' FROM users");
  await query(
    "INSERT INTO notifications (user_id,message) SELECT id,'3 sample bookings are waiting for confirmation.' FROM users WHERE role='admin'");
}

const counts = await query(`SELECT
  (SELECT COUNT(*)::int FROM users) AS users,
  (SELECT COUNT(*)::int FROM services) AS services,
  (SELECT COUNT(*)::int FROM bookings) AS bookings,
  (SELECT COUNT(*)::int FROM notifications) AS notifications`);
console.log(`Added ${added} bookings.`, counts.rows[0]);
await pool.end();

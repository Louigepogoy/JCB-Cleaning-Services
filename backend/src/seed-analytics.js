// Generates 12 months of SIMULATED business data for the analytics case study.
//   customers (users) .... 72 rows     payments ............ ~150 rows
//   bookings ............. ~165 rows   reviews ............. ~110 rows
//   marketing campaigns .. 60 rows (5 channels x 12 months)
// Run: npm run seed:analytics          (skips if already seeded)
//      npm run seed:analytics -- --reset   (wipe the sample data, then regenerate)
import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { query, initDb, pool } from './db.js';

// small deterministic random generator so the data is the same on every run
let seed = 20260101;
const rand = () => {
  seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const between = (a, b) => a + rand() * (b - a);
const pick = (arr) => arr[Math.floor(rand() * arr.length)];
const weighted = (items, weights) => {
  const total = weights.reduce((a, b) => a + b, 0);
  let r = rand() * total;
  for (let i = 0; i < items.length; i++) { r -= weights[i]; if (r <= 0) return items[i]; }
  return items[items.length - 1];
};

const FIRST = ['Maria', 'Juan', 'Ana', 'Carlo', 'Liza', 'Mark', 'Jessa', 'Paolo', 'Grace', 'Miguel', 'Rica', 'Joel', 'Nina', 'Ramon', 'Bea', 'Dennis', 'Kyla', 'Allan', 'Mae', 'Jerome', 'Trisha', 'Noel', 'Camille', 'Vince'];
const LAST = ['Santos', 'Reyes', 'Cruz', 'Garcia', 'Mendoza', 'Torres', 'Flores', 'Ramos', 'Aquino', 'Bautista', 'Navarro', 'Castillo'];
const AREAS = ['Lahug', 'IT Park', 'Mandaue City', 'Talisay City', 'Banilad', 'Mactan', 'Guadalupe', 'Capitol Site'];
const CHANNELS = ['Facebook', 'Google Ads', 'Instagram', 'Flyers', 'Referral'];
const CHANNEL_W = [0.3, 0.17, 0.17, 0.08, 0.28];
const CPA = { Facebook: 420, 'Google Ads': 690, Instagram: 510, Flyers: 780, Referral: 230 }; // cost per new customer
const LEAD_RATE = { Facebook: 0.18, 'Google Ads': 0.12, Instagram: 0.15, Flyers: 0.07, Referral: 0.4 };
const SERVICES = ['House Cleaning', 'Commercial Cleaning', 'Mattress Cleaning', 'Carpet Cleaning', 'Hard Floor Cleaning', 'Upholstery Cleaning'];
const SVC_W = [0.32, 0.1, 0.14, 0.16, 0.1, 0.18];
const SVC_GROWTH = [0.02, 0.09, 0.0, 0.06, 0.0, -0.02]; // weight growth per month
const SVC_RATING = [4.5, 4.3, 3.8, 4.4, 4.2, 4.0];
const SEASON = [0.85, 0.9, 1.0, 1.15, 1.2, 0.95, 0.9, 0.95, 1.0, 1.05, 1.1, 1.35]; // Jan..Dec
const METHODS = ['GCash', 'Cash', 'Card', 'Bank Transfer'];
const METHOD_W = [0.4, 0.3, 0.15, 0.15];
const COMMENTS = {
  5: ['Excellent service, spotless!', 'Very professional team.', 'Highly recommended, will book again.', 'Great value for the price.'],
  4: ['Good job overall.', 'Clean and on time.', 'Nice work, small areas missed.'],
  3: ['Okay, but arrived a bit late.', 'Average result.'],
  2: ['Not fully satisfied with the result.'],
  1: ['Poor service, needs improvement.'],
};

await initDb();

if (process.argv.includes('--reset')) {
  await query("DELETE FROM users WHERE email LIKE '%@sample.jcb'");
  await query('DELETE FROM marketing_campaigns');
  console.log('Previous sample data removed.');
}
const existing = await query("SELECT COUNT(*)::int AS n FROM users WHERE email LIKE '%@sample.jcb'");
if (existing.rows[0].n >= 50) {
  console.log('Sample analytics data already exists. Use "npm run seed:analytics -- --reset" to regenerate.');
  await pool.end();
  process.exit(0);
}

const now = new Date();
const monthStart = (offset) => new Date(now.getFullYear(), now.getMonth() - offset, 1);
const MONTHS = Array.from({ length: 12 }, (_, i) => monthStart(12 - i)); // 12 full months before this one
const daysIn = (d) => new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();

const { rows: svcRows } = await query('SELECT id,name,price::float AS price FROM services');
const svc = Object.fromEntries(svcRows.map((s) => [s.name, s]));

// ---- customers: 72, more sign-ups in later months (business is growing) ----
const hash = await bcrypt.hash('Customer123!', 10);
const customers = [];
const monthWeights = MONTHS.map((_, i) => 1 + i * 0.12);
for (let i = 0; i < 72; i++) {
  const mi = MONTHS.indexOf(weighted(MONTHS, monthWeights));
  const m = MONTHS[mi];
  const created = new Date(m.getFullYear(), m.getMonth(), 1 + Math.floor(rand() * (daysIn(m) - 1)), 8 + Math.floor(rand() * 10));
  const name = `${FIRST[i % FIRST.length]} ${LAST[Math.floor(i / FIRST.length) % LAST.length]}`;
  const source = weighted(CHANNELS, CHANNEL_W);
  const { rows } = await query(
    `INSERT INTO users (name,email,password_hash,role,source,created_at)
     VALUES ($1,$2,$3,'customer',$4,$5) RETURNING id`,
    [name, `customer${i + 1}@sample.jcb`, hash, source, created]);
  customers.push({ id: rows[0].id, created, source, area: pick(AREAS) });
}

// ---- bookings + payments + reviews ----
let nb = 0, np = 0, nr = 0;
for (let mi = 0; mi < MONTHS.length; mi++) {
  const m = MONTHS[mi];
  const count = Math.round(8 * (1 + 0.07 * mi) * SEASON[m.getMonth()]);
  const weights = SVC_W.map((w, i) => w * (1 + SVC_GROWTH[i] * mi));
  for (let k = 0; k < count; k++) {
    const when = new Date(m.getFullYear(), m.getMonth(), 1 + Math.floor(rand() * daysIn(m)), 8 + Math.floor(rand() * 9));
    const eligible = customers.filter((c) => c.created.getTime() < when.getTime() - 86400000);
    if (!eligible.length) continue;
    const c = pick(eligible);
    const si = SERVICES.indexOf(weighted(SERVICES, weights));
    const s = svc[SERVICES[si]];
    if (!s) continue;
    const status = rand() < 0.08 ? 'cancelled' : 'completed';
    const created = new Date(when.getTime() - Math.floor(between(1, 7) * 86400000));
    const { rows } = await query(
      `INSERT INTO bookings (user_id,service_id,address,phone,scheduled_at,notes,status,created_at)
       VALUES ($1,$2,$3,$4,$5,'',$6,$7) RETURNING id`,
      [c.id, s.id, `${c.area}, Cebu`, `+6391${Math.floor(10000000 + rand() * 89999999)}`, when, status, created]);
    nb++;
    if (status !== 'completed') continue;
    const amount = Math.round(s.price * pick([1, 1, 1, 1.1, 0.95]));
    await query('INSERT INTO payments (booking_id,amount,method,paid_at) VALUES ($1,$2,$3,$4)',
      [rows[0].id, amount, weighted(METHODS, METHOD_W), when]);
    np++;
    if (rand() < 0.72) {
      const rating = Math.max(1, Math.min(5, Math.round(SVC_RATING[si] + between(-1.3, 0.9))));
      await query('INSERT INTO reviews (booking_id,user_id,rating,comment,created_at) VALUES ($1,$2,$3,$4,$5)',
        [rows[0].id, c.id, rating, pick(COMMENTS[rating]), new Date(when.getTime() + 86400000)]);
      nr++;
    }
  }
}

// ---- marketing campaigns: 5 channels x 12 months = 60 rows (conversions match real sign-ups) ----
let nm = 0;
for (const m of MONTHS) {
  for (const ch of CHANNELS) {
    const conv = customers.filter((c) => c.source === ch && c.created.getFullYear() === m.getFullYear() && c.created.getMonth() === m.getMonth()).length;
    const cost = Math.round(Math.max(conv, 1) * CPA[ch] * between(0.8, 1.3));
    const leads = Math.max(conv, Math.round(conv / LEAD_RATE[ch] + between(0, 3)));
    const label = m.toLocaleString('en', { month: 'short', year: 'numeric' });
    await query('INSERT INTO marketing_campaigns (channel,name,month,cost,leads,conversions) VALUES ($1,$2,$3,$4,$5,$6)',
      [ch, `${ch} ${label} campaign`, m.toISOString().slice(0, 10), cost, leads, conv]);
    nm++;
  }
}

console.log(`Created: ${customers.length} customers, ${nb} bookings, ${np} payments, ${nr} reviews, ${nm} marketing campaigns.`);
await pool.end();

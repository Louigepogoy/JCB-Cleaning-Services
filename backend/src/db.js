import pg from 'pg';
import bcrypt from 'bcryptjs';
import 'dotenv/config';

export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

export const query = (text, params) => pool.query(text, params);

// [name, description, price, cost to deliver (labor + supplies)]
const DEFAULT_SERVICES = [
  ['House Cleaning', 'Complete top-to-bottom cleaning for your home.', 1500, 900],
  ['Commercial Cleaning', 'Offices, shops and commercial spaces.', 3500, 2400],
  ['Mattress Cleaning', 'Deep clean and allergen removal for mattresses.', 800, 450],
  ['Carpet Cleaning', 'Stain removal and deep carpet shampoo.', 1200, 650],
  ['Hard Floor Cleaning', 'Scrub, polish and restore hard floors.', 1000, 650],
  ['Upholstery Cleaning', 'Sofas, chairs and fabric furniture cleaning.', 1100, 700],
];

export async function initDb() {
  await query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'customer' CHECK (role IN ('admin','customer')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS services (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      price NUMERIC(10,2) NOT NULL DEFAULT 0,
      active BOOLEAN NOT NULL DEFAULT TRUE
    );
    CREATE TABLE IF NOT EXISTS bookings (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      service_id INTEGER NOT NULL REFERENCES services(id),
      address TEXT NOT NULL,
      phone TEXT NOT NULL,
      scheduled_at TIMESTAMPTZ NOT NULL,
      notes TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending','confirmed','completed','cancelled')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    ALTER TABLE users ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'Website';
    ALTER TABLE users ADD COLUMN IF NOT EXISTS phone TEXT NOT NULL DEFAULT '';
    ALTER TABLE users ADD COLUMN IF NOT EXISTS address TEXT NOT NULL DEFAULT '';
    ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar TEXT NOT NULL DEFAULT '';
    ALTER TABLE services ADD COLUMN IF NOT EXISTS cost NUMERIC(10,2) NOT NULL DEFAULT 0;
    CREATE TABLE IF NOT EXISTS payments (
      id SERIAL PRIMARY KEY,
      booking_id INTEGER UNIQUE NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
      amount NUMERIC(10,2) NOT NULL,
      method TEXT NOT NULL DEFAULT 'Cash',
      paid_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS reviews (
      id SERIAL PRIMARY KEY,
      booking_id INTEGER UNIQUE NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
      comment TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS marketing_campaigns (
      id SERIAL PRIMARY KEY,
      channel TEXT NOT NULL,
      name TEXT NOT NULL,
      month DATE NOT NULL,
      cost NUMERIC(10,2) NOT NULL DEFAULT 0,
      leads INTEGER NOT NULL DEFAULT 0,
      conversions INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS contact_messages (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      phone TEXT NOT NULL DEFAULT '',
      message TEXT NOT NULL,
      read BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS notifications (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      message TEXT NOT NULL,
      read BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  const { rows: s } = await query('SELECT COUNT(*)::int AS n FROM services');
  if (s[0].n === 0) {
    for (const [name, description, price, cost] of DEFAULT_SERVICES) {
      await query('INSERT INTO services (name, description, price, cost) VALUES ($1,$2,$3,$4)', [name, description, price, cost]);
    }
  }
  for (const [name, , , cost] of DEFAULT_SERVICES) {
    await query('UPDATE services SET cost=$1 WHERE name=$2 AND cost=0', [cost, name]);
  }

  const email = (process.env.ADMIN_EMAIL || 'admin@jcb.com').toLowerCase();
  const { rows: a } = await query('SELECT id FROM users WHERE email=$1', [email]);
  if (a.length === 0) {
    const hash = await bcrypt.hash(process.env.ADMIN_PASSWORD || 'Admin123!', 10);
    await query("INSERT INTO users (name,email,password_hash,role) VALUES ('Administrator',$1,$2,'admin')", [email, hash]);
    console.log(`Admin account created: ${email}`);
  }

  const demoEmail = (process.env.DEMO_EMAIL || 'customer@jcb.com').toLowerCase();
  const { rows: d } = await query('SELECT id FROM users WHERE email=$1', [demoEmail]);
  if (d.length === 0) {
    const hash = await bcrypt.hash(process.env.DEMO_PASSWORD || 'Customer123!', 10);
    await query("INSERT INTO users (name,email,password_hash,role) VALUES ('Demo Customer',$1,$2,'customer')", [demoEmail, hash]);
    console.log(`Demo customer created: ${demoEmail}`);
  }
}

import pool from './db.js';
import bcrypt from 'bcrypt';

export async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS companies (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      website_url TEXT,
      phone_number TEXT,
      logo_url TEXT,
      brand_color TEXT DEFAULT '#ea580c',
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      company_id INTEGER REFERENCES companies(id) ON DELETE SET NULL,
      first_name TEXT,
      last_name TEXT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('superadmin','manager','rep')),
      knocktrakr_enabled BOOLEAN DEFAULT true,
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS knocks (
      id SERIAL PRIMARY KEY,
      company_id INTEGER REFERENCES companies(id),
      rep_id INTEGER REFERENCES users(id),
      address TEXT,
      street_number TEXT,
      street_name TEXT,
      city TEXT,
      lat NUMERIC,
      lng NUMERIC,
      outcome TEXT DEFAULT 'no_answer',
      notes TEXT,
      is_lead BOOLEAN DEFAULT false,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS knock_leads (
      id SERIAL PRIMARY KEY,
      knock_id INTEGER REFERENCES knocks(id),
      company_id INTEGER REFERENCES companies(id),
      rep_id INTEGER REFERENCES users(id),
      homeowner_name TEXT,
      phone TEXT,
      address TEXT,
      notes TEXT,
      status TEXT DEFAULT 'new',
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS rep_shifts (
      id SERIAL PRIMARY KEY,
      rep_id INTEGER REFERENCES users(id),
      company_id INTEGER REFERENCES companies(id),
      clock_in TIMESTAMPTZ,
      clock_out TIMESTAMPTZ,
      total_knocks INTEGER DEFAULT 0,
      total_leads INTEGER DEFAULT 0
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS neighborhoods (
      id SERIAL PRIMARY KEY,
      company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      address TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS neighborhood_assignments (
      neighborhood_id INTEGER REFERENCES neighborhoods(id) ON DELETE CASCADE,
      rep_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      PRIMARY KEY (neighborhood_id, rep_id)
    )
  `);

  // Add new columns to existing tables without dropping data
  await pool.query(`ALTER TABLE companies ADD COLUMN IF NOT EXISTS acculynx_api_key TEXT`);
  await pool.query(`ALTER TABLE companies ADD COLUMN IF NOT EXISTS acculynx_push_enabled BOOLEAN DEFAULT false`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS email TEXT`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS invite_token TEXT`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS invite_token_expires_at TIMESTAMPTZ`);
  await pool.query(`ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL`);
  await pool.query(`ALTER TABLE knock_leads ADD COLUMN IF NOT EXISTS acculynx_sync_status TEXT DEFAULT 'pending'`);
  await pool.query(`ALTER TABLE knock_leads ADD COLUMN IF NOT EXISTS acculynx_error TEXT`);
  await pool.query(`ALTER TABLE knock_leads ADD COLUMN IF NOT EXISTS acculynx_contact_id TEXT`);
  await pool.query(`ALTER TABLE knock_leads ADD COLUMN IF NOT EXISTS acculynx_job_id TEXT`);

  const { rows } = await pool.query('SELECT COUNT(*) FROM users');
  if (parseInt(rows[0].count) === 0) {
    const hash = await bcrypt.hash(process.env.ADMIN_PASSWORD || 'admin123', 10);
    await pool.query(
      `INSERT INTO users (username, password_hash, role) VALUES ($1, $2, $3)`,
      ['admin', hash, 'superadmin']
    );
  }

  console.log('Database initialized successfully');
}

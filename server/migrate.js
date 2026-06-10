import pg from 'pg';
import bcrypt from 'bcrypt';

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function migrate() {
  try {
    console.log('Connecting to database...');
    await pool.query('SELECT 1');
    console.log('Connected. Creating tables...');

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
    console.log('✓ companies table');

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
    console.log('✓ users table');

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
    console.log('✓ knocks table');

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
    console.log('✓ knock_leads table');

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
    console.log('✓ rep_shifts table');

    const { rows } = await pool.query('SELECT COUNT(*) FROM users');
    if (parseInt(rows[0].count) === 0) {
      console.log('Seeding users...');
      const hash = await bcrypt.hash('admin123', 10);
      
      await pool.query(
        `INSERT INTO users (username, password_hash, role, first_name, last_name) VALUES ($1, $2, $3, $4, $5)`,
        ['admin', hash, 'superadmin', 'Admin', 'User']
      );
      console.log('✓ admin (superadmin)');

      await pool.query(
        `INSERT INTO users (username, password_hash, role, first_name, last_name) VALUES ($1, $2, $3, $4, $5)`,
        ['manager1', hash, 'manager', 'Jane', 'Manager']
      );
      console.log('✓ manager1 (manager)');

      await pool.query(
        `INSERT INTO users (username, password_hash, role, first_name, last_name) VALUES ($1, $2, $3, $4, $5)`,
        ['rep1', hash, 'rep', 'John', 'Rep']
      );
      console.log('✓ rep1 (rep)');
    } else {
      console.log('Users already exist, skipping seed');
    }

    console.log('\n✅ Migration complete!');
    process.exit(0);
  } catch (err) {
    console.error('\n❌ Migration failed:', err.message);
    process.exit(1);
  }
}

migrate();

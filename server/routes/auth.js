import { Router } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import pool from '../db.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

const MOCK_USERS = [
  { id: 1, username: 'admin', password_hash: '$2b$10$examplehash', role: 'superadmin', company_id: null, first_name: 'Admin', last_name: 'User', knocktrakr_enabled: true },
  { id: 2, username: 'manager1', password_hash: '$2b$10$examplehash', role: 'manager', company_id: 1, first_name: 'Jane', last_name: 'Manager', knocktrakr_enabled: true },
  { id: 3, username: 'rep1', password_hash: '$2b$10$examplehash', role: 'rep', company_id: 1, first_name: 'John', last_name: 'Rep', knocktrakr_enabled: true },
];

let dbAvailable = false;
pool.query('SELECT 1')
  .then(() => { dbAvailable = true; })
  .catch(() => { console.log('Auth: using mock data mode'); });

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts, please try again later' },
});

function signToken(user) {
  return jwt.sign(
    { id: user.id, username: user.username, role: user.role, companyId: user.company_id },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
}

function userPayload(user) {
  return {
    id: user.id,
    username: user.username,
    role: user.role,
    companyId: user.company_id,
    companyName: user.company_name || null,
    firstName: user.first_name,
    lastName: user.last_name,
    knocktrakrEnabled: user.knocktrakr_enabled,
  };
}

router.post('/login', loginLimiter, async (req, res) => {
  const { username, password } = req.body;
  try {
    let user;
    if (dbAvailable) {
      const { rows } = await pool.query(
        `SELECT u.*, c.name as company_name FROM users u
         LEFT JOIN companies c ON u.company_id = c.id
         WHERE u.username = $1`,
        [username]
      );
      user = rows[0];
    } else {
      user = MOCK_USERS.find(u => u.username === username);
    }

    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    // Accounts with no password_hash (pending invite) cannot log in
    if (!user.password_hash) return res.status(401).json({ error: 'Invalid credentials' });

    const valid = dbAvailable ? await bcrypt.compare(password, user.password_hash) : (password === 'admin123');
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

    res.json({ token: signToken(user), user: userPayload(user) });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/me', authMiddleware, async (req, res) => {
  try {
    let user;
    if (dbAvailable) {
      const { rows } = await pool.query(
        `SELECT u.*, c.name as company_name FROM users u
         LEFT JOIN companies c ON u.company_id = c.id
         WHERE u.id = $1`,
        [req.user.id]
      );
      user = rows[0];
    } else {
      user = MOCK_USERS.find(u => u.id === req.user.id);
    }
    if (!user) return res.status(401).json({ error: 'User not found' });
    res.json(userPayload(user));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── Invite flow (public routes, no auth required) ────────────────────────────

router.get('/invite/:token', async (req, res) => {
  if (!dbAvailable) return res.status(503).json({ error: 'Database unavailable' });
  try {
    const { rows } = await pool.query(
      `SELECT first_name, last_name, username FROM users
       WHERE invite_token = $1 AND invite_token_expires_at > NOW()`,
      [req.params.token]
    );
    if (!rows[0]) {
      return res.status(404).json({ error: 'This invite link has expired or is invalid. Ask your manager to send a new one.' });
    }
    const { first_name, last_name, username } = rows[0];
    res.json({ firstName: first_name, lastName: last_name, username });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/invite/:token/accept', async (req, res) => {
  if (!dbAvailable) return res.status(503).json({ error: 'Database unavailable' });
  const { password } = req.body;
  if (!password || password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }
  try {
    const { rows } = await pool.query(
      `SELECT u.*, c.name as company_name FROM users u
       LEFT JOIN companies c ON u.company_id = c.id
       WHERE u.invite_token = $1 AND u.invite_token_expires_at > NOW()`,
      [req.params.token]
    );
    if (!rows[0]) {
      return res.status(404).json({ error: 'This invite link has expired or is invalid. Ask your manager to send a new one.' });
    }
    const user = rows[0];
    const hash = await bcrypt.hash(password, 10);
    await pool.query(
      `UPDATE users SET password_hash = $1, invite_token = NULL, invite_token_expires_at = NULL WHERE id = $2`,
      [hash, user.id]
    );
    res.json({ token: signToken(user), user: userPayload(user) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;

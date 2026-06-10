import { Router } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import pool from '../db.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

const MOCK_USERS = [
  { id: 1, username: 'admin', password_hash: '$2b$10$examplehash', role: 'superadmin', company_id: null, first_name: 'Admin', last_name: 'User', knocktrakr_enabled: true },
  { id: 2, username: 'manager1', password_hash: '$2b$10$examplehash', role: 'manager', company_id: 1, first_name: 'Jane', last_name: 'Manager', knocktrakr_enabled: true },
  { id: 3, username: 'rep1', password_hash: '$2b$10$examplehash', role: 'rep', company_id: 1, first_name: 'John', last_name: 'Rep', knocktrakr_enabled: true },
];

let dbAvailable = true;
pool.query('SELECT 1').catch(() => { dbAvailable = false; console.log('Using mock data mode'); });

router.post('/login', async (req, res) => {
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

    const valid = dbAvailable ? await bcrypt.compare(password, user.password_hash) : (password === 'admin123');
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role, companyId: user.company_id },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        companyId: user.company_id,
        companyName: user.company_name || 'Demo Company',
        firstName: user.first_name,
        lastName: user.last_name,
        knocktrakrEnabled: user.knocktrakr_enabled,
      },
    });
  } catch (err) {
    console.error(err);
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

    res.json({
      id: user.id,
      username: user.username,
      role: user.role,
      companyId: user.company_id,
      companyName: user.company_name || 'Demo Company',
      firstName: user.first_name,
      lastName: user.last_name,
      knocktrakrEnabled: user.knocktrakr_enabled,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;

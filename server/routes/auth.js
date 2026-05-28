import { Router } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import pool from '../db.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const { rows } = await pool.query(
      `SELECT u.*, c.name as company_name FROM users u
       LEFT JOIN companies c ON u.company_id = c.id
       WHERE u.username = $1`,
      [username]
    );
    const user = rows[0];
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    const valid = await bcrypt.compare(password, user.password_hash);
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
        companyName: user.company_name,
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
    const { rows } = await pool.query(
      `SELECT u.*, c.name as company_name FROM users u
       LEFT JOIN companies c ON u.company_id = c.id
       WHERE u.id = $1`,
      [req.user.id]
    );
    const user = rows[0];
    if (!user) return res.status(401).json({ error: 'User not found' });

    res.json({
      id: user.id,
      username: user.username,
      role: user.role,
      companyId: user.company_id,
      companyName: user.company_name,
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

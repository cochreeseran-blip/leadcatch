import { Router } from 'express';
import bcrypt from 'bcrypt';
import pool from '../db.js';
import { authMiddleware, adminOnly } from '../middleware/auth.js';

const router = Router();
router.use(authMiddleware);
router.use(adminOnly);

router.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT u.id, u.company_id, u.first_name, u.last_name, u.username,
             u.role, u.knocktrakr_enabled, u.is_active, u.created_at,
             c.name as company_name
      FROM users u
      LEFT JOIN companies c ON u.company_id = c.id
      ORDER BY u.created_at DESC
    `);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/', async (req, res) => {
  const { username, password, role, companyId, firstName, lastName, knocktrakrEnabled } = req.body;
  try {
    const hash = await bcrypt.hash(password, 10);
    const { rows } = await pool.query(
      `INSERT INTO users (username, password_hash, role, company_id, first_name, last_name, knocktrakr_enabled)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, company_id, first_name, last_name, username, role, knocktrakr_enabled, is_active, created_at`,
      [username, hash, role, companyId || null, firstName, lastName, knocktrakrEnabled !== false]
    );
    const user = rows[0];

    const { rows: compRows } = await pool.query(`SELECT name FROM companies WHERE id = $1`, [user.company_id]);
    user.company_name = compRows[0]?.name || null;

    res.json(user);
  } catch (err) {
    console.error(err);
    if (err.code === '23505') return res.status(409).json({ error: 'Username already exists' });
    res.status(500).json({ error: 'Server error' });
  }
});

router.put('/:id', async (req, res) => {
  const { username, password, role, companyId, firstName, lastName, knocktrakrEnabled, isActive } = req.body;
  try {
    let query, params;
    if (password) {
      const hash = await bcrypt.hash(password, 10);
      query = `UPDATE users SET username=$1, password_hash=$2, role=$3, company_id=$4,
               first_name=$5, last_name=$6, knocktrakr_enabled=$7, is_active=$8
               WHERE id=$9 RETURNING id, company_id, first_name, last_name, username, role, knocktrakr_enabled, is_active, created_at`;
      params = [username, hash, role, companyId || null, firstName, lastName, knocktrakrEnabled !== false, isActive !== false, req.params.id];
    } else {
      query = `UPDATE users SET username=$1, role=$2, company_id=$3,
               first_name=$4, last_name=$5, knocktrakr_enabled=$6, is_active=$7
               WHERE id=$8 RETURNING id, company_id, first_name, last_name, username, role, knocktrakr_enabled, is_active, created_at`;
      params = [username, role, companyId || null, firstName, lastName, knocktrakrEnabled !== false, isActive !== false, req.params.id];
    }
    const { rows } = await pool.query(query, params);
    const user = rows[0];
    const { rows: compRows } = await pool.query(`SELECT name FROM companies WHERE id = $1`, [user.company_id]);
    user.company_name = compRows[0]?.name || null;
    res.json(user);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.delete('/:id', async (req, res) => {
  if (parseInt(req.params.id) === req.user.id) {
    return res.status(400).json({ error: 'Cannot delete yourself' });
  }
  try {
    await pool.query(`DELETE FROM users WHERE id = $1`, [req.params.id]);
    res.json({ deleted: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;

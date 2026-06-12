import { Router } from 'express';
import pool from '../db.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();
router.use(authMiddleware);

let dbAvailable = false;
pool.query('SELECT 1')
  .then(() => { dbAvailable = true; })
  .catch(() => {});

const MOCK_KNOCKS = [];
const MOCK_LEADS = [];
let nextKnockId = 1;
let nextLeadId = 1;

router.post('/knock', async (req, res) => {
  const { address, lat, lng, outcome, notes, isLead } = req.body;
  try {
    if (dbAvailable) {
      const { rows } = await pool.query(
        `INSERT INTO knocks (company_id, rep_id, address, lat, lng, outcome, notes, is_lead)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
        [req.user.companyId, req.user.id, address, lat, lng, outcome || 'no_answer', notes || null, isLead || false]
      );
      return res.json(rows[0]);
    }
    const knock = {
      id: nextKnockId++,
      company_id: req.user.companyId,
      rep_id: req.user.id,
      address,
      lat,
      lng,
      outcome: outcome || 'no_answer',
      notes: notes || null,
      is_lead: isLead || false,
      created_at: new Date().toISOString(),
    };
    MOCK_KNOCKS.push(knock);
    res.json(knock);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/lead', async (req, res) => {
  const { knockId, homeownerName, phone, address, notes } = req.body;
  try {
    if (dbAvailable) {
      const { rows } = await pool.query(
        `INSERT INTO knock_leads (knock_id, company_id, rep_id, homeowner_name, phone, address, notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
        [knockId, req.user.companyId, req.user.id, homeownerName, phone, address, notes]
      );
      if (knockId) {
        await pool.query(`UPDATE knocks SET is_lead = true WHERE id = $1`, [knockId]);
      }
      return res.json(rows[0]);
    }
    const lead = {
      id: nextLeadId++,
      knock_id: knockId,
      company_id: req.user.companyId,
      rep_id: req.user.id,
      homeowner_name: homeownerName,
      phone,
      address,
      notes,
      status: 'new',
      created_at: new Date().toISOString(),
    };
    MOCK_LEADS.push(lead);
    if (knockId) {
      const knock = MOCK_KNOCKS.find(k => k.id === knockId);
      if (knock) knock.is_lead = true;
    }
    res.json(lead);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/stats', async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (dbAvailable) {
      const { rows: knockRows } = await pool.query(
        `SELECT COUNT(*) FROM knocks WHERE rep_id = $1 AND created_at >= $2`,
        [req.user.id, today]
      );
      const { rows: leadRows } = await pool.query(
        `SELECT COUNT(*) FROM knock_leads WHERE rep_id = $1 AND created_at >= $2`,
        [req.user.id, today]
      );
      return res.json({
        knocks_today: parseInt(knockRows[0].count),
        leads_today: parseInt(leadRows[0].count),
      });
    }
    const knocksToday = MOCK_KNOCKS.filter(k => k.rep_id === req.user.id && new Date(k.created_at) >= today).length;
    const leadsToday = MOCK_LEADS.filter(l => l.rep_id === req.user.id && new Date(l.created_at) >= today).length;
    res.json({ knocks_today: knocksToday, leads_today: leadsToday });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/knocks', async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (dbAvailable) {
      const { rows } = await pool.query(
        `SELECT * FROM knocks WHERE rep_id = $1 AND created_at >= $2 ORDER BY created_at DESC`,
        [req.user.id, today]
      );
      return res.json(rows);
    }
    const result = MOCK_KNOCKS
      .filter(k => k.rep_id === req.user.id && new Date(k.created_at) >= today)
      .slice().reverse();
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/manager/stats', async (req, res) => {
  if (req.user.role !== 'manager' && req.user.role !== 'superadmin') {
    return res.status(403).json({ error: 'Forbidden' });
  }
  if (!dbAvailable) return res.status(503).json({ error: 'Database unavailable' });
  try {
    const dateFrom = req.query.dateFrom || new Date().toISOString().slice(0, 10);
    const dateTo = req.query.dateTo || new Date().toISOString().slice(0, 10);
    const from = new Date(dateFrom);
    const to = new Date(dateTo);
    to.setHours(23, 59, 59, 999);

    const companyId = req.user.companyId;

    const { rows: knockRows } = await pool.query(
      `SELECT COUNT(*) FROM knocks WHERE company_id = $1 AND created_at >= $2 AND created_at <= $3`,
      [companyId, from, to]
    );
    const { rows: leadRows } = await pool.query(
      `SELECT COUNT(*) FROM knock_leads WHERE company_id = $1 AND created_at >= $2 AND created_at <= $3`,
      [companyId, from, to]
    );
    const { rows: repRows } = await pool.query(
      `SELECT COUNT(DISTINCT rep_id) FROM knocks WHERE company_id = $1 AND created_at >= $2 AND created_at <= $3`,
      [companyId, from, to]
    );

    const totalKnocks = parseInt(knockRows[0].count);
    const totalLeads = parseInt(leadRows[0].count);
    const activeReps = parseInt(repRows[0].count);
    const conversionRate = totalKnocks > 0 ? ((totalLeads / totalKnocks) * 100).toFixed(1) : '0.0';

    res.json({ total_knocks: totalKnocks, total_leads: totalLeads, active_reps: activeReps, conversion_rate: conversionRate });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/manager/reps', async (req, res) => {
  if (req.user.role !== 'manager' && req.user.role !== 'superadmin') {
    return res.status(403).json({ error: 'Forbidden' });
  }
  if (!dbAvailable) return res.status(503).json({ error: 'Database unavailable' });
  try {
    const dateFrom = req.query.dateFrom || new Date().toISOString().slice(0, 10);
    const dateTo = req.query.dateTo || new Date().toISOString().slice(0, 10);
    const from = new Date(dateFrom);
    const to = new Date(dateTo);
    to.setHours(23, 59, 59, 999);

    const companyId = req.user.companyId;

    const { rows } = await pool.query(
      `SELECT u.id as rep_id,
              CONCAT(u.first_name, ' ', u.last_name) as name,
              u.username,
              COUNT(DISTINCT k.id) as knocks_count,
              COUNT(DISTINCT kl.id) as leads_count,
              MAX(k.created_at) as last_active
       FROM users u
       LEFT JOIN knocks k ON k.rep_id = u.id AND k.created_at >= $2 AND k.created_at <= $3
       LEFT JOIN knock_leads kl ON kl.rep_id = u.id AND kl.created_at >= $2 AND kl.created_at <= $3
       WHERE u.company_id = $1 AND u.role = 'rep'
       GROUP BY u.id
       ORDER BY knocks_count DESC`,
      [companyId, from, to]
    );

    const reps = rows.map(r => ({
      ...r,
      knocks_count: parseInt(r.knocks_count),
      leads_count: parseInt(r.leads_count),
      conversion_rate: r.knocks_count > 0 ? ((r.leads_count / r.knocks_count) * 100).toFixed(1) : '0.0',
    }));

    res.json(reps);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/manager/reps/:repId/knocks', async (req, res) => {
  if (req.user.role !== 'manager' && req.user.role !== 'superadmin') {
    return res.status(403).json({ error: 'Forbidden' });
  }
  if (req.user.role === 'manager') {
    const { rows: repCheck } = await pool.query(
      `SELECT id FROM users WHERE id = $1 AND company_id = $2`,
      [req.params.repId, req.user.companyId]
    );
    if (!repCheck[0]) return res.status(403).json({ error: 'Forbidden' });
  }
  try {
    const dateFrom = req.query.dateFrom || new Date().toISOString().slice(0, 10);
    const dateTo = req.query.dateTo || new Date().toISOString().slice(0, 10);
    const from = new Date(dateFrom);
    const to = new Date(dateTo);
    to.setHours(23, 59, 59, 999);

    const { rows } = await pool.query(
      `SELECT k.*,
              kl.homeowner_name, kl.phone as lead_phone, kl.notes as lead_notes, kl.status as lead_status
       FROM knocks k
       LEFT JOIN knock_leads kl ON kl.knock_id = k.id
       WHERE k.rep_id = $1 AND k.created_at >= $2 AND k.created_at <= $3
       ORDER BY k.created_at DESC`,
      [req.params.repId, from, to]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/manager/export', async (req, res) => {
  if (req.user.role !== 'manager' && req.user.role !== 'superadmin') {
    return res.status(403).json({ error: 'Forbidden' });
  }
  if (!dbAvailable) return res.status(503).json({ error: 'Database unavailable' });
  try {
    const dateFrom = req.query.dateFrom || new Date().toISOString().slice(0, 10);
    const dateTo = req.query.dateTo || new Date().toISOString().slice(0, 10);
    const from = new Date(dateFrom);
    const to = new Date(dateTo);
    to.setHours(23, 59, 59, 999);

    const companyId = req.user.companyId;

    const { rows } = await pool.query(
      `SELECT CONCAT(u.first_name, ' ', u.last_name) as rep_name,
              k.address, k.lat, k.lng, k.created_at, k.outcome, k.notes,
              kl.homeowner_name, kl.phone
       FROM knocks k
       JOIN users u ON u.id = k.rep_id
       LEFT JOIN knock_leads kl ON kl.knock_id = k.id
       WHERE k.company_id = $1 AND k.created_at >= $2 AND k.created_at <= $3
       ORDER BY k.created_at DESC`,
      [companyId, from, to]
    );

    const headers = 'Rep Name,Address,Lat,Lng,Date,Time,Outcome,Homeowner Name,Phone,Notes\n';
    const csvRows = rows.map(r => {
      const dt = new Date(r.created_at);
      const date = dt.toLocaleDateString('en-US');
      const time = dt.toLocaleTimeString('en-US');
      const escape = v => `"${(v || '').toString().replace(/"/g, '""')}"`;
      return [
        escape(r.rep_name), escape(r.address), r.lat || '', r.lng || '',
        date, time, r.outcome, escape(r.homeowner_name), escape(r.phone), escape(r.notes)
      ].join(',');
    }).join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="knocktrakr-export-${dateFrom}.csv"`);
    res.send(headers + csvRows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/shift/current', async (req, res) => {
  if (!dbAvailable) return res.json(null);
  try {
    const { rows } = await pool.query(
      `SELECT * FROM rep_shifts WHERE rep_id = $1 AND clock_out IS NULL ORDER BY clock_in DESC LIMIT 1`,
      [req.user.id]
    );
    res.json(rows[0] || null);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/shift/start', async (req, res) => {
  if (!dbAvailable) return res.status(503).json({ error: 'Database unavailable' });
  try {
    const { rows } = await pool.query(
      `INSERT INTO rep_shifts (rep_id, company_id, clock_in) VALUES ($1, $2, NOW()) RETURNING *`,
      [req.user.id, req.user.companyId]
    );
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/shift/end', async (req, res) => {
  if (!dbAvailable) return res.status(503).json({ error: 'Database unavailable' });
  try {
    const { rows: shiftRows } = await pool.query(
      `SELECT * FROM rep_shifts WHERE rep_id = $1 AND clock_out IS NULL ORDER BY clock_in DESC LIMIT 1`,
      [req.user.id]
    );
    if (!shiftRows[0]) return res.status(404).json({ error: 'No open shift' });

    const shift = shiftRows[0];
    const { rows: knockCount } = await pool.query(
      `SELECT COUNT(*) FROM knocks WHERE rep_id = $1 AND created_at >= $2`,
      [req.user.id, shift.clock_in]
    );
    const { rows: leadCount } = await pool.query(
      `SELECT COUNT(*) FROM knock_leads WHERE rep_id = $1 AND created_at >= $2`,
      [req.user.id, shift.clock_in]
    );

    const { rows } = await pool.query(
      `UPDATE rep_shifts SET clock_out = NOW(), total_knocks = $1, total_leads = $2
       WHERE id = $3 RETURNING *`,
      [parseInt(knockCount[0].count), parseInt(leadCount[0].count), shift.id]
    );
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;

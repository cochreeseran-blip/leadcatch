import { Router } from 'express';
import fetch from 'node-fetch';
import pool from '../db.js';
import { authMiddleware } from '../middleware/auth.js';
import { createContact, createJob } from '../services/acculynx.js';
import { notifyManagersOfLead } from '../services/email.js';

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

      const lead = rows[0];
      res.json(lead);

      // Fire AccuLynx + email in background — don't block the response
      if (knockId) {
        setImmediate(() => pushLeadIntegrations(lead, req.user));
      }
      return;
    }

    // Mock path (no DB)
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

async function pushLeadIntegrations(lead, repUser) {
  try {
    // Only trigger for inspection_set outcome
    const { rows: knockRows } = await pool.query(
      `SELECT outcome FROM knocks WHERE id = $1`, [lead.knock_id]
    );
    const outcome = knockRows[0]?.outcome;
    if (outcome !== 'inspection_set') return;

    const { rows: compRows } = await pool.query(
      `SELECT name, acculynx_api_key, acculynx_push_enabled FROM companies WHERE id = $1`,
      [lead.company_id]
    );
    const company = compRows[0];
    if (!company) return;

    const repName = [repUser.firstName, repUser.lastName].filter(Boolean).join(' ') || repUser.username;

    // ── AccuLynx push ────────────────────────────────────────────────────────
    if (company.acculynx_push_enabled && company.acculynx_api_key) {
      let syncStatus = 'failed';
      let acculynxError = null;
      let contactId = null;
      let jobId = null;

      try {
        const nameParts = (lead.homeowner_name || '').split(' ');
        const firstName = nameParts[0] || '';
        const lastName = nameParts.slice(1).join(' ') || '';

        const contact = await createContact(company.acculynx_api_key, {
          firstName,
          lastName,
          phone: lead.phone,
          address: lead.address,
        });
        contactId = contact?.id ?? contact?.contactId ?? null;

        const job = await createJob(company.acculynx_api_key, {
          contactId,
          address: lead.address,
          notes: `Inspection set via KnockTrakr by ${repName}`,
        });
        jobId = job?.id ?? job?.jobId ?? null;

        syncStatus = 'success';
        console.log(`AccuLynx: pushed lead ${lead.id} — contact ${contactId}, job ${jobId}`);
      } catch (err) {
        acculynxError = err.message;
        console.error(`AccuLynx: failed to push lead ${lead.id}:`, err.message);
      }

      await pool.query(
        `UPDATE knock_leads SET acculynx_sync_status=$1, acculynx_error=$2, acculynx_contact_id=$3, acculynx_job_id=$4 WHERE id=$5`,
        [syncStatus, acculynxError, contactId?.toString() ?? null, jobId?.toString() ?? null, lead.id]
      );
    }

    // ── Email notification ───────────────────────────────────────────────────
    try {
      await notifyManagersOfLead(pool, {
        companyId: lead.company_id,
        companyName: company.name,
        repName,
        address: lead.address,
        homeownerName: lead.homeowner_name,
        phone: lead.phone,
        outcome,
        timestamp: lead.created_at,
      });
    } catch (err) {
      console.error(`Email: failed to notify managers for lead ${lead.id}:`, err.message);
    }
  } catch (err) {
    console.error(`pushLeadIntegrations: unexpected error for lead ${lead.id}:`, err.message);
  }
}

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

router.get('/geocode/reverse', async (req, res) => {
  const { lat, lng } = req.query;
  if (!lat || !lng) return res.status(400).json({ error: 'lat and lng required' });

  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) return res.status(503).json({ error: 'Geocoding not configured' });

  try {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${apiKey}`;
    const response = await fetch(url);
    const data = await response.json();

    if (data.status !== 'OK' || !data.results?.[0]) {
      console.log(`Geocode: no result for (${lat}, ${lng}) — status: ${data.status}`);
      return res.json({ address: null });
    }

    const components = data.results[0].address_components;
    const get = (type, field = 'long_name') =>
      components.find(c => c.types.includes(type))?.[field] ?? '';

    const streetNumber = get('street_number');
    const route        = get('route');
    const city         = get('locality') || get('sublocality_level_1') || get('administrative_area_level_2');
    const state        = get('administrative_area_level_1', 'short_name');
    const zip          = get('postal_code');

    const street  = [streetNumber, route].filter(Boolean).join(' ');
    const address = [street, city, [state, zip].filter(Boolean).join(' ')]
      .filter(Boolean).join(', ');

    console.log(`Geocode: (${lat}, ${lng}) → "${address}"`);
    res.json({ address: address || data.results[0].formatted_address });
  } catch (err) {
    console.error('Geocode error:', err.message);
    res.status(500).json({ error: 'Geocoding failed' });
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

// ── Neighborhoods ────────────────────────────────────────────────────────────

// GET /neighborhoods/mine must be registered before /:id patterns
router.get('/neighborhoods/mine', async (req, res) => {
  if (!dbAvailable) return res.status(503).json({ error: 'Database unavailable' });
  try {
    const { rows } = await pool.query(
      `SELECT n.id, n.name, n.address
       FROM neighborhoods n
       JOIN neighborhood_assignments na ON na.neighborhood_id = n.id
       WHERE na.rep_id = $1
       ORDER BY n.name ASC`,
      [req.user.id]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/neighborhoods', async (req, res) => {
  if (req.user.role !== 'manager' && req.user.role !== 'superadmin') {
    return res.status(403).json({ error: 'Forbidden' });
  }
  if (!dbAvailable) return res.status(503).json({ error: 'Database unavailable' });
  try {
    const { rows } = await pool.query(
      `SELECT n.*,
              COALESCE(
                json_agg(json_build_object('id', u.id, 'name', CONCAT(u.first_name, ' ', u.last_name)))
                FILTER (WHERE u.id IS NOT NULL), '[]'
              ) AS assigned_reps
       FROM neighborhoods n
       LEFT JOIN neighborhood_assignments na ON na.neighborhood_id = n.id
       LEFT JOIN users u ON u.id = na.rep_id
       WHERE n.company_id = $1
       GROUP BY n.id
       ORDER BY n.created_at DESC`,
      [req.user.companyId]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/neighborhoods', async (req, res) => {
  if (req.user.role !== 'manager' && req.user.role !== 'superadmin') {
    return res.status(403).json({ error: 'Forbidden' });
  }
  if (!dbAvailable) return res.status(503).json({ error: 'Database unavailable' });
  const { name, address } = req.body;
  if (!name || !address) return res.status(400).json({ error: 'name and address required' });
  try {
    const { rows } = await pool.query(
      `INSERT INTO neighborhoods (company_id, name, address) VALUES ($1, $2, $3) RETURNING *`,
      [req.user.companyId, name, address]
    );
    res.json({ ...rows[0], assigned_reps: [] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.put('/neighborhoods/:id', async (req, res) => {
  if (req.user.role !== 'manager' && req.user.role !== 'superadmin') {
    return res.status(403).json({ error: 'Forbidden' });
  }
  if (!dbAvailable) return res.status(503).json({ error: 'Database unavailable' });
  const { name, address } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE neighborhoods SET name=$1, address=$2 WHERE id=$3 AND company_id=$4 RETURNING *`,
      [name, address, req.params.id, req.user.companyId]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Not found' });
    const { rows: assigned } = await pool.query(
      `SELECT u.id, CONCAT(u.first_name, ' ', u.last_name) AS name
       FROM neighborhood_assignments na JOIN users u ON u.id = na.rep_id
       WHERE na.neighborhood_id = $1`,
      [req.params.id]
    );
    res.json({ ...rows[0], assigned_reps: assigned });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.delete('/neighborhoods/:id', async (req, res) => {
  if (req.user.role !== 'manager' && req.user.role !== 'superadmin') {
    return res.status(403).json({ error: 'Forbidden' });
  }
  if (!dbAvailable) return res.status(503).json({ error: 'Database unavailable' });
  try {
    await pool.query(
      `DELETE FROM neighborhoods WHERE id=$1 AND company_id=$2`,
      [req.params.id, req.user.companyId]
    );
    res.json({ deleted: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Replace all assignments for a neighborhood in one call
router.put('/neighborhoods/:id/assign', async (req, res) => {
  if (req.user.role !== 'manager' && req.user.role !== 'superadmin') {
    return res.status(403).json({ error: 'Forbidden' });
  }
  if (!dbAvailable) return res.status(503).json({ error: 'Database unavailable' });
  const { repIds } = req.body;
  try {
    const { rows: nRows } = await pool.query(
      `SELECT id FROM neighborhoods WHERE id=$1 AND company_id=$2`,
      [req.params.id, req.user.companyId]
    );
    if (!nRows[0]) return res.status(404).json({ error: 'Not found' });

    await pool.query(`DELETE FROM neighborhood_assignments WHERE neighborhood_id=$1`, [req.params.id]);
    if (Array.isArray(repIds) && repIds.length > 0) {
      await pool.query(
        `INSERT INTO neighborhood_assignments (neighborhood_id, rep_id)
         SELECT $1, unnest($2::int[]) ON CONFLICT DO NOTHING`,
        [req.params.id, repIds]
      );
    }
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;

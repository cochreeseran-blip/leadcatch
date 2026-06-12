import { Router } from 'express';
import fetch from 'node-fetch';
import dns from 'dns';
import net from 'net';
import { promisify } from 'util';
import pool from '../db.js';
import { authMiddleware, adminOnly } from '../middleware/auth.js';
import { testConnection } from '../services/acculynx.js';

const dnsLookup = promisify(dns.lookup);

function isPrivateIp(ip) {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number);
    return (
      a === 127 ||
      a === 10 ||
      a === 0 ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 169 && b === 254)
    );
  }
  if (net.isIPv6(ip)) {
    const n = ip.toLowerCase();
    return n === '::1' || n.startsWith('fc') || n.startsWith('fd') || n.startsWith('fe80');
  }
  return true;
}

async function assertSafeUrl(urlString) {
  let parsed;
  try { parsed = new URL(urlString); } catch { throw new Error('Invalid URL'); }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('Only HTTP/HTTPS URLs are allowed');
  }

  const hostname = parsed.hostname;

  if (hostname === 'localhost' || hostname.endsWith('.local') || hostname.endsWith('.internal')) {
    throw new Error('Internal hostnames are not allowed');
  }

  if (net.isIP(hostname)) {
    if (isPrivateIp(hostname)) throw new Error('Private IP addresses are not allowed');
    return;
  }

  const { address } = await dnsLookup(hostname);
  if (isPrivateIp(address)) throw new Error('URL resolves to a private IP address');
}

const router = Router();
router.use(authMiddleware);
router.use(adminOnly);

// Never return acculynx_api_key — expose only a boolean that a key is configured
const COMPANY_SAFE_COLS = `
  c.id, c.name, c.website_url, c.phone_number, c.logo_url, c.brand_color,
  c.is_active, c.created_at, c.acculynx_push_enabled,
  (c.acculynx_api_key IS NOT NULL AND c.acculynx_api_key != '') AS acculynx_key_configured
`;

router.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT ${COMPANY_SAFE_COLS}, COUNT(u.id) AS rep_count
      FROM companies c
      LEFT JOIN users u ON u.company_id = c.id
      GROUP BY c.id
      ORDER BY c.created_at DESC
    `);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/', async (req, res) => {
  const { name, websiteUrl, phoneNumber } = req.body;
  try {
    const { rows } = await pool.query(
      `INSERT INTO companies (name, website_url, phone_number) VALUES ($1, $2, $3) RETURNING *`,
      [name, websiteUrl, phoneNumber]
    );
    const c = rows[0];
    // Return safe shape (no acculynx_api_key)
    res.json({ ...c, acculynx_api_key: undefined, acculynx_key_configured: false });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.put('/:id', async (req, res) => {
  const { name, websiteUrl, phoneNumber } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE companies SET name=$1, website_url=$2, phone_number=$3 WHERE id=$4
       RETURNING id, name, website_url, phone_number, logo_url, brand_color, is_active, created_at,
                 acculynx_push_enabled,
                 (acculynx_api_key IS NOT NULL AND acculynx_api_key != '') AS acculynx_key_configured`,
      [name, websiteUrl, phoneNumber, req.params.id]
    );
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await pool.query(`DELETE FROM users WHERE company_id = $1`, [req.params.id]);
    await pool.query(`DELETE FROM companies WHERE id = $1`, [req.params.id]);
    res.json({ deleted: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/:id/branding', async (req, res) => {
  try {
    const { rows } = await pool.query(`SELECT * FROM companies WHERE id = $1`, [req.params.id]);
    const company = rows[0];
    if (!company) return res.status(404).json({ error: 'Not found' });
    if (!company.website_url) return res.status(400).json({ error: 'No website URL' });

    let url = company.website_url;
    if (!url.startsWith('http')) url = 'https://' + url;
    const domain = new URL(url).hostname;

    try {
      await assertSafeUrl(url);
    } catch (ssrfErr) {
      return res.status(400).json({ error: `Unsafe URL: ${ssrfErr.message}` });
    }

    let logoUrl = `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;
    let themeColor = '#ea580c';
    let displayName = company.name;

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeout);
      const html = await response.text();

      const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
      if (titleMatch) displayName = titleMatch[1].trim();

      const themeMatch = html.match(/<meta[^>]*name=["']theme-color["'][^>]*content=["']([^"']+)["']/i)
        || html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*name=["']theme-color["']/i);
      if (themeMatch) themeColor = themeMatch[1].trim();

      const iconMatch = html.match(/<link[^>]*rel=["'][^"']*apple-touch-icon[^"']*["'][^>]*href=["']([^"']+)["']/i)
        || html.match(/<link[^>]*href=["']([^"']+)["'][^>]*rel=["'][^"']*apple-touch-icon[^"']*["']/i);
      if (iconMatch) {
        const iconHref = iconMatch[1].trim();
        logoUrl = iconHref.startsWith('http') ? iconHref : `https://${domain}${iconHref.startsWith('/') ? '' : '/'}${iconHref}`;
      }
    } catch (fetchErr) {
      console.log('Branding fetch failed, using fallbacks:', fetchErr.message);
    }

    await pool.query(
      `UPDATE companies SET logo_url=$1, brand_color=$2 WHERE id=$3`,
      [logoUrl, themeColor, req.params.id]
    );

    res.json({ logoUrl, themeColor, displayName, domain });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── AccuLynx CRM integration ─────────────────────────────────────────────────

// Save (or clear) an AccuLynx API key for a company
router.put('/:id/acculynx-key', async (req, res) => {
  const { apiKey } = req.body;
  try {
    const keyValue = apiKey && apiKey.trim() ? apiKey.trim() : null;
    await pool.query(
      `UPDATE companies SET acculynx_api_key = $1 WHERE id = $2`,
      [keyValue, req.params.id]
    );
    // If key was cleared, also disable push
    if (!keyValue) {
      await pool.query(`UPDATE companies SET acculynx_push_enabled = false WHERE id = $1`, [req.params.id]);
    }
    res.json({ configured: !!keyValue });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Test the AccuLynx connection using the stored key
router.post('/:id/acculynx-test', async (req, res) => {
  try {
    const { rows } = await pool.query(`SELECT acculynx_api_key FROM companies WHERE id = $1`, [req.params.id]);
    const company = rows[0];
    if (!company) return res.status(404).json({ error: 'Not found' });
    if (!company.acculynx_api_key) return res.status(400).json({ error: 'No API key configured' });

    await testConnection(company.acculynx_api_key);
    res.json({ ok: true });
  } catch (err) {
    console.error('AccuLynx test failed:', err.message);
    res.status(400).json({ error: err.message });
  }
});

// Toggle whether leads are pushed to AccuLynx
router.put('/:id/acculynx-push', async (req, res) => {
  const { enabled } = req.body;
  try {
    const { rows: compRows } = await pool.query(
      `SELECT acculynx_api_key FROM companies WHERE id = $1`,
      [req.params.id]
    );
    if (!compRows[0]) return res.status(404).json({ error: 'Not found' });
    if (enabled && !compRows[0].acculynx_api_key) {
      return res.status(400).json({ error: 'Cannot enable push without an API key' });
    }
    await pool.query(
      `UPDATE companies SET acculynx_push_enabled = $1 WHERE id = $2`,
      [!!enabled, req.params.id]
    );
    res.json({ acculynx_push_enabled: !!enabled });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;

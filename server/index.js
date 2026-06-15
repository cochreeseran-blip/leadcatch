import express from 'express';
import cors from 'cors';
import { existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { initDb } from './init-db.js';
import authRouter from './routes/auth.js';
import companiesRouter from './routes/companies.js';
import usersRouter from './routes/users.js';
import knocktrakrRouter from './routes/knocktrakr.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 8080;

// Supports comma-separated origins, e.g. "https://app.knocktrakr.com,https://knocktrakr.com"
const _allowedOrigins = process.env.ALLOWED_ORIGIN
  ? process.env.ALLOWED_ORIGIN.split(',').map(s => s.trim()).filter(Boolean)
  : [];
app.use(cors({
  origin: _allowedOrigins.length === 0
    ? false
    : _allowedOrigins.length === 1
      ? _allowedOrigins[0]
      : (origin, cb) => cb(null, !origin || _allowedOrigins.includes(origin)),
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', version: '1.0' });
});

app.use('/api/auth', authRouter);
app.use('/api/companies', companiesRouter);
app.use('/api/users', usersRouter);
app.use('/api/knocktrakr', knocktrakrRouter);

const publicPath = join(__dirname, 'public');
if (existsSync(publicPath)) {
  // Never cache the service worker — browsers must always re-fetch it to detect updates
  app.get('/service-worker.js', (req, res) => {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.sendFile(join(publicPath, 'service-worker.js'));
  });
  app.use(express.static(publicPath));
  app.get(/^(?!\/api).*/, (req, res) => {
    res.sendFile(join(publicPath, 'index.html'));
  });
}

async function start() {
  if (!process.env.JWT_SECRET) {
    console.error('FATAL: JWT_SECRET environment variable is not set');
    process.exit(1);
  }

  try {
    await initDb();
  } catch (err) {
    console.log('DB not available, running in frontend-only mode:', err.message);
  }
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

start();

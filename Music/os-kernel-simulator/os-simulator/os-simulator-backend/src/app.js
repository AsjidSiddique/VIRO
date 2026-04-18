const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const path = require('path');

const errorHandler = require('./middleware/errorHandler');
const authRoutes = require('./routes/authRoutes');
const simulationRoutes = require('./routes/simulationRoutes');
const profileRoutes = require('./routes/profileRoutes');
const csvRoutes = require('./routes/csvRoutes');
const processRoutes = require('./routes/processRoutes');
const logger = require('./utils/logger');

const app = express();

// ── Security Headers ──────────────────────────────
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);

// ── CORS ──────────────────────────────────────────
app.use(
  cors({
    origin: process.env.CLIENT_URL || 'http://localhost:3000',
    credentials: true,
  })
);

// ── Rate Limiting ─────────────────────────────────
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  message: { message: 'Too many requests. Please try again later.' },
});
app.use('/api', limiter);

// ── Body Parsers ──────────────────────────────────
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser(process.env.COOKIE_SECRET));

// ── Static Files — serve uploaded avatars ─────────
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// ── HTTP Request Logging ──────────────────────────
app.use(
  morgan('combined', {
    stream: { write: (msg) => logger.info(msg.trim()) },
  })
);

// ── Health Check ──────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// ── Routes ────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/simulate', simulationRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/csv', csvRoutes);
app.use('/api/processes', processRoutes);

// ── 404 Handler ───────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ message: `Route ${req.originalUrl} not found.` });
});

// ── Central Error Handler ─────────────────────────
app.use(errorHandler);

module.exports = app;

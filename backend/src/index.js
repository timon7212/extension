require('dotenv').config();

const express = require('express');
const cors = require('cors');

const authRoutes = require('./modules/auth/auth.routes');
const leadsRoutes = require('./modules/leads/leads.routes');
const eventsRoutes = require('./modules/events/events.routes');
const tasksRoutes = require('./modules/tasks/tasks.routes');
const analyticsRoutes = require('./modules/analytics/analytics.routes');

const app = express();
const PORT = process.env.PORT || 3001;

// ---------------------
// Middleware
// ---------------------

// CORS — разрешаем запросы из Chrome Extension и Dashboard.
// В продакшене можно ограничить origin-ами.
app.use(cors({
  origin: true,                // разрешить любой origin (для внутренней сети ОК)
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json());

// Логирование запросов (для мониторинга активности)
app.use((req, res, next) => {
  const now = new Date().toISOString();
  console.log(`[${now}] ${req.method} ${req.path} — ${req.ip}`);
  next();
});

// ---------------------
// Routes
// ---------------------
app.use('/api/auth', authRoutes);
app.use('/api/leads', leadsRoutes);
app.use('/api/events', eventsRoutes);
app.use('/api/tasks', tasksRoutes);
app.use('/api/analytics', analyticsRoutes);

// Health check (used by extension to test connection)
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ---------------------
// Error handler
// ---------------------
app.use((err, req, res, _next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// ---------------------
// Start — bind to 0.0.0.0 so it's accessible from other devices on the network
// ---------------------
app.listen(PORT, '0.0.0.0', () => {
  console.log('');
  console.log('='.repeat(55));
  console.log(`  ✅ Outreach API running on port ${PORT}`);
  console.log(`  📡 Local:   http://localhost:${PORT}`);
  console.log(`  📡 Network: http://<YOUR_IP>:${PORT}`);
  console.log('');
  console.log('  Чтобы узнать свой IP в сети:');
  console.log('    Windows: ipconfig');
  console.log('    Mac/Linux: ifconfig или ip addr');
  console.log('='.repeat(55));
  console.log('');
});

module.exports = app;

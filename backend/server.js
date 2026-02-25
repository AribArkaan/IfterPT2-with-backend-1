// ==================== MAIN SERVER FILE ====================
// Clean, modular structure with separated concerns
const express = require('express');
const cors = require('cors');
const path = require('path');
const http = require('http');
const WebSocket = require('ws');

// ==================== IMPORTS ====================
const { pool, dbConfig } = require('./config/database');
const errorHandler = require('./middleware/errorHandler');
const { subscribeClient, broadcast, getConnectedClients } = require('./utils/broadcast');
const { uploadDir } = require('./utils/fileUpload');
const { startPeriodicCleanup } = require('./utils/eventCleanup');

// Routes
const settingsRouter = require('./routes/settings');
const prayerTimesRouter = require('./routes/prayerTimes');
const contentRouter = require('./routes/content');
const uploadRouter = require('./routes/upload');
const iqomahRouter = require('./routes/iqomah');
const runningTextRouter = require('./routes/runningText');
const iqomahRunningTextRouter = require('./routes/iqomahRunningText');
const eventsRouter = require('./routes/events');
const financesRouter = require('./routes/finances');

// ==================== APP SETUP ====================
const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// ==================== MIDDLEWARE ====================
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use('/uploads', express.static(path.join(__dirname, 'public', 'uploads')));

// ==================== WEBSOCKET SETUP ====================
wss.on('connection', (ws) => {
  subscribeClient(ws);
});

// ==================== API ROUTES ====================
app.use('/api/settings', settingsRouter);
app.use('/api/prayer-times', prayerTimesRouter);
app.use('/api/content', contentRouter);
app.use('/api/upload', uploadRouter);
app.use('/api/iqomah', iqomahRouter);
app.use('/api/running-text', runningTextRouter);
app.use('/api/iqomah-running-text', iqomahRunningTextRouter);
app.use('/api/events', eventsRouter);
app.use('/api/finances', financesRouter);

// Health check & WebSocket info
app.get('/api/health', (req, res) => {
  pool.query('SELECT 1', (err) => {
    if (err) {
      return res.status(503).json({
        success: false,
        status: 'unhealthy',
        database: 'disconnected'
      });
    }
    res.json({
      success: true,
      status: 'healthy',
      database: 'connected',
      websocket: getConnectedClients() + ' clients connected'
    });
  });
});

// ==================== STATIC PAGES ====================
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ==================== 404 & ERROR HANDLERS ====================
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Route not found',
    path: req.path
  });
});

app.use(errorHandler);

// ==================== START SERVER ====================
const PORT = process.env.PORT || 3000;

server.listen(PORT, async () => {
  console.log('');
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║                                                            ║');
  console.log('║          🕌 MASJID DISPLAY SYSTEM - STARTED 🕌            ║');
  console.log('║                                                            ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log('');
  console.log(`✅ Server running on: http://localhost:${PORT}`);
  console.log(`✅ Admin page: http://localhost:${PORT}/admin`);
  console.log(`✅ Display page: http://localhost:${PORT}/`);
  console.log(`✅ WebSocket server running on ws://localhost:${PORT}`);
  console.log('');
  console.log('📋 Database Configuration:');
  console.log(`   Host: ${dbConfig.host}`);
  console.log(`   Database: ${dbConfig.database}`);
  console.log(`   User: ${dbConfig.user}`);
  console.log('');
  console.log('Press Ctrl+C to stop the server');
  console.log('');

  // Start periodic event cleanup (every hour)
  startPeriodicCleanup();

  // Launch browser in kiosk mode
  try {
    const open = await import('open');
    const url = `http://localhost:${PORT}`;
    console.log(`🌐 Launching landing page in kiosk mode...`);
    
    await open.default(url, {
      app: {
        name: 'chrome',
        arguments: ['--kiosk', '--no-first-run', '--disable-background-networking']
      }
    });
  } catch (err) {
    console.warn('⚠️  Chrome not found, attempting to launch with default browser...');
    try {
      const open = await import('open');
      await open.default(`http://localhost:${PORT}`);
    } catch (fallbackErr) {
      console.error('Failed to open browser:', fallbackErr.message);
    }
  }
});

// ==================== GRACEFUL SHUTDOWN ====================
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
    pool.end(() => {
      console.log('Database pool closed');
      process.exit(0);
    });
  });
});

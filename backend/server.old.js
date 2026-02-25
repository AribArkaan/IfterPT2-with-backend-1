// server.js - FIXED VERSION (UPDATED TO MATCH init-db.js)
const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const path = require('path');
const WebSocket = require('ws');
const http = require('http');
const multer = require('multer');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// ==================== MIDDLEWARE ====================
app.use(cors());
app.use(express.json());
app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));

// ==================== DATABASE CONNECTION ====================
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'masjid_db',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  charset: 'utf8mb4'
};

const pool = mysql.createPool(dbConfig);

// Test database connection
pool.getConnection((err, connection) => {
  if (err) {
    console.error('❌ Database connection failed:', err.message);
    process.exit(1);
  }
  console.log('✅ Database connected successfully');
  connection.release();
});

// ==================== WEBSOCKET SETUP ====================
const clients = new Set();

wss.on('connection', (ws) => {
  console.log('🔌 Client connected to WebSocket');
  clients.add(ws);

  ws.on('close', () => {
    console.log('🔌 Client disconnected from WebSocket');
    clients.delete(ws);
  });

  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
    clients.delete(ws);
  });
});

function broadcast(type, data) {
  const message = JSON.stringify({ type, data });
  clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      try {
        client.send(message);
      } catch (error) {
        console.error('Error broadcasting to client:', error);
      }
    }
  });
}

// ==================== HELPER FUNCTIONS ====================
function handleError(res, error, message = 'Internal server error') {
  console.error(`❌ ${message}:`, error);
  res.status(500).json({
    success: false,
    error: message,
    details: process.env.NODE_ENV === 'development' ? error.message : undefined
  });
}

function handleSuccess(res, data, message = 'Success') {
  res.json({
    success: true,
    message,
    data
  });
}

const uploadDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
  console.log(`✅ Created upload directory: ${uploadDir}`);
}

// Konfigurasi multer untuk upload file
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, 'upload-' + uniqueSuffix + ext);
  }
});

const detectFileType = (mimetype, extname) => {
  const imageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
  const imageExts = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];

  const videoTypes = ['video/mp4', 'video/webm', 'video/ogg'];
  const videoExts = ['.mp4', '.webm', '.ogg'];

  if (imageTypes.includes(mimetype) || imageExts.includes(extname)) {
    return 'image';
  }

  if (videoTypes.includes(mimetype) || videoExts.includes(extname)) {
    return 'video';
  }

  return null;
};

const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|gif|webp|mp4|webm|ogg/;
  const extname = allowedTypes.test(file.originalname.toLowerCase().split('.').pop());
  const mimetype = allowedTypes.test(file.mimetype);

  if (mimetype && extname) {
    return cb(null, true);
  } else {
    cb(new Error('Hanya file gambar (JPEG, JPG, PNG, GIF, WebP) dan video (MP4, WebM, OGG) yang diizinkan'));
  }
};

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 20 * 1024 * 1024 // 20MB
  }
});



// ==================== SETTINGS ROUTES ====================
app.get('/api/settings', (req, res) => {
  const sql = 'SELECT setting_key, setting_value, updated_at FROM settings ORDER BY setting_key';

  pool.query(sql, (err, results) => {
    if (err) return handleError(res, err, 'Failed to fetch settings');
    handleSuccess(res, results);
  });
});

app.get('/api/settings/finance_display', (req, res) => {
  const sql = 'SELECT setting_value FROM settings WHERE setting_key = "finance_display"';

  pool.query(sql, (err, results) => {
    if (err) {
      console.error('❌ Error fetching finance display:', err);
      return handleError(res, err, 'Failed to fetch finance display setting');
    }
    const value = results.length > 0 ? results[0].setting_value : '1';
    // Mengirimkan format boolean yang ditunggu oleh frontend
    handleSuccess(res, { finance_display: value === '1' });
  });
});

app.put('/api/settings/finance_display', (req, res) => {
  // Terima 'setting_value' (dari frontend terbaru) ATAU 'enabled' (dari frontend lama)
  const incomingValue = req.body.setting_value !== undefined ? req.body.setting_value : req.body.enabled;

  if (incomingValue === undefined || incomingValue === null) {
    return res.status(400).json({ success: false, error: 'Missing setting_value field' });
  }

  // Pastikan masuk ke database sebagai string '1' atau '0'
  const value = (incomingValue === true || incomingValue === '1' || incomingValue === 1) ? '1' : '0';

  const sql = `
    INSERT INTO settings (setting_key, setting_value) 
    VALUES (?, ?)
    ON DUPLICATE KEY UPDATE setting_value = ?
  `;

  pool.query(sql, ['finance_display', value, value], (err, result) => {
    if (err) {
      console.error('❌ Error updating finance display:', err);
      return res.status(500).json({ success: false, error: 'Failed to update setting', details: err.message });
    }

    // BROADCAST WEBSOCKET AKAN BERHASIL DIJALANKAN!
    broadcast('settings_updated', {
      key: 'finance_display',
      value: value
    });

    handleSuccess(res, { finance_display: value === '1' }, 'Setting updated successfully');
  });
});

app.get('/api/settings/:key', (req, res) => {
  const sql = 'SELECT setting_key, setting_value, updated_at FROM settings WHERE setting_key = ?';

  pool.query(sql, [req.params.key], (err, results) => {
    if (err) return handleError(res, err, 'Failed to fetch setting');
    if (results.length === 0) {
      return res.status(404).json({ success: false, error: 'Setting not found' });
    }
    handleSuccess(res, results[0]);
  });
});

app.put('/api/settings/:key', (req, res) => {
  const { key } = req.params;
  const { setting_value } = req.body; // Pastikan frontend mengirim JSON: { "setting_value": "1" }

  // Validasi: pastikan setting_value benar-benar dikirim dari frontend
  if (setting_value === undefined) {
    return res.status(400).json({
      success: false,
      error: "setting_value is required in request body"
    });
  }

  // Query SQL menggunakan fitur UPSERT (Update or Insert)
  const query = `
        INSERT INTO settings (setting_key, setting_value) 
        VALUES (?, ?) 
        ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)
    `;

  // Eksekusi query ke database
  pool.query(query, [key, setting_value], (err, results) => {
    // Penanganan jika terjadi error pada database
    if (err) {
      console.error(`❌ Error updating setting '${key}':`, err.message);
      return res.status(500).json({
        success: false,
        error: "Failed to update setting in database",
        details: err.message
      });
    }

    // Penanganan jika query berhasil dieksekusi
    res.status(200).json({
      success: true,
      message: `Setting '${key}' updated successfully`,
      data: {
        setting_key: key,
        setting_value: setting_value
      }
    });
  });
});

app.post('/api/settings/bulk', (req, res) => {
  const { settings } = req.body;

  if (!Array.isArray(settings) || settings.length === 0) {
    return res.status(400).json({ success: false, error: 'Invalid settings data' });
  }

  const sql = `
    INSERT INTO settings (setting_key, setting_value) 
    VALUES ? 
    ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)
  `;

  const values = settings.map(s => [s.key, s.value]);

  pool.query(sql, [values], (err) => {
    if (err) return handleError(res, err, 'Failed to update settings');
    broadcast('settings_updated', settings);
    handleSuccess(res, settings, 'Settings updated successfully');
  });
});

// ==================== PRAYER TIMES ROUTES ====================
app.get('/api/prayer-times', (req, res) => {
  const sql = 'SELECT id, prayer_name, time, ihtiyat, updated_at FROM prayer_times ORDER BY id';

  pool.query(sql, (err, results) => {
    if (err) return handleError(res, err, 'Failed to fetch prayer times');
    handleSuccess(res, results);
  });
});

app.get('/api/prayer-times/:id', (req, res) => {
  const sql = 'SELECT id, prayer_name, time, ihtiyat, updated_at FROM prayer_times WHERE id = ?';

  pool.query(sql, [req.params.id], (err, results) => {
    if (err) return handleError(res, err, 'Failed to fetch prayer time');
    if (results.length === 0) {
      return res.status(404).json({ success: false, error: 'Prayer time not found' });
    }
    handleSuccess(res, results[0]);
  });
});

app.put('/api/prayer-times/:id', (req, res) => {
  const { prayer_name, time, ihtiyat } = req.body;
  const sql = 'UPDATE prayer_times SET prayer_name = ?, time = ?, ihtiyat = ? WHERE id = ?';

  pool.query(sql, [prayer_name, time, ihtiyat, req.params.id], (err, result) => {
    if (err) return handleError(res, err, 'Failed to update prayer time');
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, error: 'Prayer time not found' });
    }
    broadcast('prayer_times_updated', { id: req.params.id, prayer_name, time, ihtiyat });
    handleSuccess(res, { id: req.params.id, prayer_name, time, ihtiyat }, 'Prayer time updated successfully');
  });
});

app.post('/api/prayer-times/bulk', (req, res) => {
  const { prayers } = req.body;

  if (!Array.isArray(prayers) || prayers.length === 0) {
    return res.status(400).json({ success: false, error: 'Invalid prayer times data' });
  }

  pool.getConnection((err, connection) => {
    if (err) return handleError(res, err, 'Database connection failed');

    connection.beginTransaction((err) => {
      if (err) {
        connection.release();
        return handleError(res, err, 'Failed to start transaction');
      }

      let completed = 0;
      let hasError = false;

      prayers.forEach((prayer) => {
        const sql = 'UPDATE prayer_times SET time = ?, ihtiyat = ? WHERE prayer_name = ?';
        connection.query(sql, [prayer.time, prayer.ihtiyat, prayer.prayer_name], (err) => {
          if (err && !hasError) {
            hasError = true;
            connection.rollback(() => {
              connection.release();
              handleError(res, err, 'Failed to update prayer times');
            });
            return;
          }

          completed++;
          if (completed === prayers.length && !hasError) {
            connection.commit((err) => {
              if (err) {
                connection.rollback(() => {
                  connection.release();
                  handleError(res, err, 'Failed to commit transaction');
                });
                return;
              }

              connection.release();
              broadcast('prayer_times_updated', prayers);
              handleSuccess(res, prayers, 'Prayer times updated successfully');
            });
          }
        });
      });
    });
  });
});

// ==================== IMSAK TIME ROUTES ====================
app.get('/api/imsak-time', (req, res) => {
  const sql = `
        SELECT 
            time as subuh_time,
            SUBSTRING_INDEX(time, ':', 1) as subuh_hour,
            SUBSTRING_INDEX(time, ':', -1) as subuh_minute
        FROM prayer_times 
        WHERE prayer_name = 'Subuh'
        LIMIT 1
    `;

  pool.query(sql, (err, results) => {
    if (err) return handleError(res, err, 'Failed to fetch subuh time');

    if (results.length === 0) {
      return res.status(404).json({ success: false, error: 'Subuh time not found' });
    }

    const subuhTime = results[0].subuh_time;

    const [hours, minutes] = subuhTime.split(':').map(Number);

    const date = new Date();
    date.setHours(hours, minutes, 0, 0);

    date.setMinutes(date.getMinutes() - 10);

    const imsakHour = String(date.getHours()).padStart(2, '0');
    const imsakMinute = String(date.getMinutes()).padStart(2, '0');
    const imsakTime = `${imsakHour}:${imsakMinute}`;

    const isRamadhan = checkIfRamadhan(); 

    res.json({
      success: true,
      data: {
        imsak_time: imsakTime,
        subuh_time: subuhTime,
        is_active: isRamadhan, 
        display_message: isRamadhan ? `Imsak ${imsakTime} (10 menit sebelum Subuh)` : null
      }
    });
  });
});

app.get('/api/ramadhan-mode', (req, res) => {
  const sql = 'SELECT setting_value FROM settings WHERE setting_key = "ramadhan_mode"';

  pool.query(sql, (err, results) => {
    if (err) {
      console.error('Error checking ramadhan mode:', err);
      return res.json({ isRamadhan: false });
    }

    const isRamadhan = results.length > 0 ? results[0].setting_value === '1' : false;
    res.json({ isRamadhan });
  });
});

app.put('/api/ramadhan-mode', (req, res) => {
  const { enabled } = req.body;
  const value = enabled ? '1' : '0';

  const sql = `
        INSERT INTO settings (setting_key, setting_value) 
        VALUES ('ramadhan_mode', ?)
        ON DUPLICATE KEY UPDATE setting_value = ?
    `;

  pool.query(sql, [value, value], (err) => {
    if (err) return handleError(res, err, 'Failed to update ramadhan mode');

    broadcast('ramadhan_mode_updated', { enabled });
    handleSuccess(res, { enabled }, 'Ramadhan mode updated');
  });
});

function checkIfRamadhan() {

  const today = new Date();
  const month = today.getMonth() + 1; 
  const day = today.getDate();

  if (month === 3) { 
    return true;
  }

  return false;
}

// ==================== IQOMAH TIMES ROUTES ====================
app.get('/api/iqomah-times', (req, res) => {
  const sql = 'SELECT id, prayer_name, minutes, updated_at FROM iqomah_times ORDER BY id';

  pool.query(sql, (err, results) => {
    if (err) return handleError(res, err, 'Failed to fetch iqomah times');
    handleSuccess(res, results);
  });
});

app.put('/api/iqomah-times/:id', (req, res) => {
  const { minutes } = req.body;

  // SQL YANG BENAR: UPDATE, bukan SELECT
  const sql = 'UPDATE iqomah_times SET minutes = ? WHERE id = ?';

  pool.query(sql, [minutes, req.params.id], (err, result) => {
    if (err) return handleError(res, err, 'Failed to update iqomah time');

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, error: 'Iqomah time not found' });
    }

    // Kirim notifikasi real-time ke client lain
    broadcast('iqomah_times_updated', { id: req.params.id, minutes });

    handleSuccess(res, { id: req.params.id, minutes }, 'Iqomah time updated successfully');
  });
});

app.get('/api/iqomah-settings', (req, res) => {
  const sql = 'SELECT setting_key, setting_value FROM settings WHERE setting_key IN ("iqomah_default", "iqomah_duration", "adzan_redirect_minutes")';

  pool.query(sql, (err, results) => {
    if (err) return handleError(res, err, 'Failed to fetch iqomah settings');

    const settings = {};
    results.forEach(row => {
      settings[row.setting_key] = row.setting_value;
    });

    handleSuccess(res, settings);
  });
});

// ==================== RUNNING TEXT ROUTES ====================
app.get('/api/running-text', (req, res) => {
  const sql = 'SELECT id, text, font_family, font_size, speed, is_active, created_at FROM running_text ORDER BY id';

  pool.query(sql, (err, results) => {
    if (err) return handleError(res, err, 'Failed to fetch running texts');
    handleSuccess(res, results);
  });
});

app.post('/api/running-text', (req, res) => {
  const { text, font_family, font_size, speed, is_active } = req.body;

  if (!text || !font_family) {
    return res.status(400).json({ success: false, error: 'Missing required fields' });
  }

  const sql = `
    INSERT INTO running_text (text, font_family, font_size, speed, is_active) 
    VALUES (?, ?, ?, ?, ?)
  `;

  pool.query(sql, [text, font_family, font_size || 16, speed || 30, is_active ? 1 : 0], (err, result) => {
    if (err) return handleError(res, err, 'Failed to add running text');
    broadcast('running_text_updated', { id: result.insertId });
    handleSuccess(res, { id: result.insertId }, 'Running text added successfully');
  });
});

app.put('/api/running-text/:id', (req, res) => {
  const { text, font_family, font_size, speed, is_active } = req.body;
  const sql = `
    UPDATE running_text 
    SET text = ?, font_family = ?, font_size = ?, speed = ?, is_active = ? 
    WHERE id = ?
  `;

  pool.query(sql, [text, font_family, font_size, speed, is_active ? 1 : 0, req.params.id], (err, result) => {
    if (err) return handleError(res, err, 'Failed to update running text');
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, error: 'Running text not found' });
    }
    broadcast('running_text_updated', { id: req.params.id });
    handleSuccess(res, { id: req.params.id }, 'Running text updated successfully');
  });
});

app.delete('/api/running-text/:id', (req, res) => {
  const sql = 'DELETE FROM running_text WHERE id = ?';

  pool.query(sql, [req.params.id], (err, result) => {
    if (err) return handleError(res, err, 'Failed to delete running text');
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, error: 'Running text not found' });
    }
    broadcast('running_text_updated', { id: req.params.id, deleted: true });
    handleSuccess(res, null, 'Running text deleted successfully');
  });
});

app.get('/api/running-text/:id', (req, res) => {
  const sql = 'SELECT id, text, font_family, font_size, speed, is_active FROM running_text WHERE id = ?';
  pool.query(sql, [req.params.id], (err, results) => {
    if (err) return handleError(res, err, 'Database error');
    if (results.length === 0) return res.status(404).json({ success: false, error: 'Not found' });
    handleSuccess(res, results[0]);
  });
});

// ==================== IQOMAH RUNNING TEXT ROUTES (KHUSUS - HALAMAN IQOMAH) ====================
app.get('/api/iqomah-running-text', (req, res) => {
  const sql = 'SELECT id, text, font_family, font_size, speed, is_active, display_order, created_at FROM iqomah_running_text ORDER BY display_order, id';

  pool.query(sql, (err, results) => {
    if (err) return handleError(res, err, 'Failed to fetch iqomah running texts');
    handleSuccess(res, results);
  });
});

app.get('/api/iqomah-running-text/:id', (req, res) => {
  const sql = 'SELECT id, text, font_family, font_size, speed, is_active, display_order FROM iqomah_running_text WHERE id = ?';

  pool.query(sql, [req.params.id], (err, results) => {
    if (err) return handleError(res, err, 'Failed to fetch iqomah running text');
    if (results.length === 0) {
      return res.status(404).json({ success: false, error: 'Iqomah running text not found' });
    }
    handleSuccess(res, results[0]);
  });
});

app.post('/api/iqomah-running-text', (req, res) => {
  const { text, font_family, font_size, speed, is_active, display_order } = req.body;

  if (!text || !font_family) {
    return res.status(400).json({ success: false, error: 'Missing required fields' });
  }

  const sql = `
    INSERT INTO iqomah_running_text (text, font_family, font_size, speed, is_active, display_order) 
    VALUES (?, ?, ?, ?, ?, ?)
  `;

  pool.query(sql, [text, font_family, font_size || 16, speed || 30, is_active ? 1 : 0, display_order || 0], (err, result) => {
    if (err) return handleError(res, err, 'Failed to add iqomah running text');
    broadcast('iqomah_running_text_updated', { id: result.insertId });
    handleSuccess(res, { id: result.insertId }, 'Iqomah running text added successfully');
  });
});

app.put('/api/iqomah-running-text/:id', (req, res) => {
  const { text, font_family, font_size, speed, is_active, display_order } = req.body;
  const sql = `
    UPDATE iqomah_running_text 
    SET text = ?, font_family = ?, font_size = ?, speed = ?, is_active = ?, display_order = ? 
    WHERE id = ?
  `;

  pool.query(sql, [text, font_family, font_size, speed, is_active ? 1 : 0, display_order || 0, req.params.id], (err, result) => {
    if (err) return handleError(res, err, 'Failed to update iqomah running text');
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, error: 'Iqomah running text not found' });
    }
    broadcast('iqomah_running_text_updated', { id: req.params.id });
    handleSuccess(res, { id: req.params.id }, 'Iqomah running text updated successfully');
  });
});

app.delete('/api/iqomah-running-text/:id', (req, res) => {
  const sql = 'DELETE FROM iqomah_running_text WHERE id = ?';

  pool.query(sql, [req.params.id], (err, result) => {
    if (err) return handleError(res, err, 'Failed to delete iqomah running text');
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, error: 'Iqomah running text not found' });
    }
    broadcast('iqomah_running_text_updated', { id: req.params.id, deleted: true });
    handleSuccess(res, null, 'Iqomah running text deleted successfully');
  });
});

// ==================== CONTENT ROUTES (NEW) ====================
app.get('/api/content', (req, res) => {
  const sql = 'SELECT id, title, content_text, content_type, image_url, video_url, display_order, is_active, created_at, updated_at FROM content ORDER BY display_order, id';

  pool.query(sql, (err, results) => {
    if (err) return handleError(res, err, 'Failed to fetch content');
    handleSuccess(res, results);
  });
});

app.get('/api/content/:id', (req, res) => {
  const sql = 'SELECT id, title, content_text, content_type, image_url, video_url, display_order, is_active, created_at, updated_at FROM content WHERE id = ?';

  pool.query(sql, [req.params.id], (err, results) => {
    if (err) return handleError(res, err, 'Failed to fetch content');
    if (results.length === 0) {
      return res.status(404).json({ success: false, error: 'Content not found' });
    }
    handleSuccess(res, results[0]);
  });
});

app.post('/api/content', (req, res) => {
  const { title, content_text, content_type, image_url, video_url, display_order, is_active } = req.body;

  if (!title) {
    return res.status(400).json({ success: false, error: 'Title is required' });
  }

  const sql = `
    INSERT INTO content (title, content_text, content_type, image_url, video_url, display_order, is_active) 
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `;

  pool.query(sql, [title, content_text || null, content_type || 'text', image_url || null, video_url || null, display_order || 0, is_active ? 1 : 0], (err, result) => {
    if (err) return handleError(res, err, 'Failed to add content');
    broadcast('content_updated', { id: result.insertId });
    handleSuccess(res, { id: result.insertId }, 'Content added successfully');
  });
});

app.put('/api/content/:id', (req, res) => {
  const { title, content_text, content_type, image_url, video_url, display_order, is_active } = req.body;
  const sql = `
    UPDATE content 
    SET title = ?, content_text = ?, content_type = ?, image_url = ?, video_url = ?, display_order = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `;

  pool.query(sql, [title, content_text || null, content_type || 'text', image_url || null, video_url || null, display_order || 0, is_active ? 1 : 0, req.params.id], (err, result) => {
    if (err) return handleError(res, err, 'Failed to update content');
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, error: 'Content not found' });
    }
    broadcast('content_updated', { id: req.params.id });
    handleSuccess(res, { id: req.params.id }, 'Content updated successfully');
  });
});

app.delete('/api/content/:id', (req, res) => {
  const sql = 'DELETE FROM content WHERE id = ?';

  pool.query(sql, [req.params.id], (err, result) => {
    if (err) return handleError(res, err, 'Failed to delete content');
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, error: 'Content not found' });
    }
    broadcast('content_updated', { id: req.params.id, deleted: true });
    handleSuccess(res, null, 'Content deleted successfully');
  });
});

app.post('/api/upload', (req, res) => {
  // Gunakan upload.single sebagai middleware di dalam route
  upload.single('file')(req, res, (err) => {
    if (err) {
      console.error('❌ Multer error:', err);
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          success: false,
          error: 'File terlalu besar. Maksimal 20MB'
        });
      }
      return res.status(400).json({
        success: false,
        error: err.message
      });
    }

    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: 'Tidak ada file yang diupload'
        });
      }

      // Deteksi tipe file dari file yang diupload
      const extname = path.extname(req.file.originalname).toLowerCase();
      const detectedType = detectFileType(req.file.mimetype, extname);

      const fileUrl = `/uploads/${req.file.filename}`;

      console.log('✅ File uploaded:', {
        filename: req.file.filename,
        originalname: req.file.originalname,
        size: req.file.size,
        mimetype: req.file.mimetype,
        type: detectedType,
        path: fileUrl
      });

      res.json({
        success: true,
        filePath: fileUrl,
        filename: req.file.filename,
        originalname: req.file.originalname,
        size: req.file.size,
        mimetype: req.file.mimetype,
        type: detectedType
      });

    } catch (error) {
      console.error('❌ Upload error:', error);
      res.status(500).json({
        success: false,
        error: 'Gagal mengupload file',
        details: error.message
      });
    }
  });
});

app.use('/uploads', express.static(path.join(__dirname, 'public', 'uploads')));

app.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        error: 'File terlalu besar. Maksimal 20MB'
      });
    }
    return res.status(400).json({
      success: false,
      error: error.message
    });
  }
  next(error);
});

app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));

// ==================== EVENTS ROUTES ====================
app.get('/api/events', (req, res) => {
  // Default: hanya tampilkan event yang belum lewat (hari ini ke depan)
  // Query parameter ?include_expired=true untuk melihat semua (admin purpose)
  const includeExpired = req.query.include_expired === 'true';

  let sql = 'SELECT id, title, description, target_date, is_active, created_at, updated_at FROM events';

  if (!includeExpired) {
    // Hanya ambil event yang target_date >= hari ini
    sql += ' WHERE DATE(target_date) >= CURDATE()';
  }

  sql += ' ORDER BY target_date ASC'; // Urutkan dari yang terdekat

  pool.query(sql, (err, results) => {
    if (err) return handleError(res, err, 'Failed to fetch events');
    handleSuccess(res, results);
  });
});

app.get('/api/events/:id', (req, res) => {
  const sql = 'SELECT id, title, description, target_date, is_active FROM events WHERE id = ?';
  pool.query(sql, [req.params.id], (err, results) => {
    if (err) return handleError(res, err, 'Failed to fetch event');
    if (results.length === 0) {
      return res.status(404).json({ success: false, error: 'Event not found' });
    }
    handleSuccess(res, results[0]);
  });
});

app.post('/api/events', (req, res) => {
  const { title, description, target_date, is_active } = req.body;

  if (!title || !target_date) {
    return res.status(400).json({ success: false, error: 'Missing required fields' });
  }

  const sql = `
    INSERT INTO events (title, description, target_date, is_active) 
    VALUES (?, ?, ?, ?)
  `;

  pool.query(sql, [title, description, target_date, is_active ? 1 : 0], (err, result) => {
    if (err) return handleError(res, err, 'Failed to add event');
    broadcast('events_updated', { id: result.insertId });
    handleSuccess(res, { id: result.insertId }, 'Event added successfully');
  });
});

app.put('/api/events/:id', (req, res) => {
  const { title, description, target_date, is_active } = req.body;
  const sql = `
    UPDATE events 
    SET title = ?, description = ?, target_date = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `;

  pool.query(sql, [title, description, target_date, is_active ? 1 : 0, req.params.id], (err, result) => {
    if (err) return handleError(res, err, 'Failed to update event');
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, error: 'Event not found' });
    }
    broadcast('events_updated', { id: req.params.id });
    handleSuccess(res, { id: req.params.id }, 'Event updated successfully');
  });
});

app.delete('/api/events/:id', (req, res) => {
  const sql = 'DELETE FROM events WHERE id = ?';

  pool.query(sql, [req.params.id], (err, result) => {
    if (err) return handleError(res, err, 'Failed to delete event');
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, error: 'Event not found' });
    }
    broadcast('events_updated', { id: req.params.id, deleted: true });
    handleSuccess(res, null, 'Event deleted successfully');
  });
});

function deleteExpiredEvents() {
  const today = new Date();
  today.setHours(0, 0, 0, 0); // Set ke tengah malam hari ini

  // Hapus event yang target_date sudah lewat (kemarin atau lebih lama)
  const sql = 'DELETE FROM events WHERE DATE(target_date) < DATE(?)';

  pool.query(sql, [today], (err, result) => {
    if (err) {
      console.error('❌ Error deleting expired events:', err);
      return;
    }

    if (result.affectedRows > 0) {
      console.log(`🗑️  Deleted ${result.affectedRows} expired event(s)`);
      // Broadcast ke semua client bahwa events telah diupdate
      broadcast('events_updated', {
        type: 'auto_deleted',
        count: result.affectedRows,
        timestamp: new Date().toISOString()
      });
    }
  });
}

// Jalankan auto-delete setiap jam (atau bisa diatur sesuai kebutuhan)
setInterval(deleteExpiredEvents, 60 * 60 * 1000); // Setiap 1 jam

// Jalankan juga saat server startup
deleteExpiredEvents();

// ==================== FINANCES ROUTES ====================
app.get('/api/finances', (req, res) => {
  const { start_date, end_date, type } = req.query;
  let sql = 'SELECT id, type, category, amount, description, transaction_date, created_at FROM finances WHERE 1=1';
  const params = [];

  if (start_date) {
    sql += ' AND transaction_date >= ?';
    params.push(start_date);
  }

  if (end_date) {
    sql += ' AND transaction_date <= ?';
    params.push(end_date);
  }

  if (type) {
    sql += ' AND type = ?';
    params.push(type);
  }

  sql += ' ORDER BY transaction_date DESC, created_at DESC';

  pool.query(sql, params, (err, results) => {
    if (err) return handleError(res, err, 'Failed to fetch finances');
    handleSuccess(res, results);
  });
});

app.get('/api/finances/:id', (req, res) => {
  const sql = 'SELECT id, type, category, amount, description, transaction_date FROM finances WHERE id = ?';

  pool.query(sql, [req.params.id], (err, results) => {
    if (err) return handleError(res, err, 'Failed to fetch finance record');
    if (results.length === 0) {
      return res.status(404).json({ success: false, error: 'Finance record not found' });
    }
    handleSuccess(res, results[0]);
  });
});

app.post('/api/finances', (req, res) => {
  const { type, category, amount, description, transaction_date } = req.body;

  if (!type || !category || !amount || !transaction_date) {
    return res.status(400).json({ success: false, error: 'Missing required fields' });
  }

  const sql = `
    INSERT INTO finances (type, category, amount, description, transaction_date) 
    VALUES (?, ?, ?, ?, ?)
  `;

  pool.query(sql, [type, category, amount, description, transaction_date], (err, result) => {
    if (err) return handleError(res, err, 'Failed to add finance record');

    // Update summary
    updateFinanceSummary(transaction_date);
    broadcast('finances_updated', { id: result.insertId });
    handleSuccess(res, { id: result.insertId }, 'Finance record added successfully');
  });
});

app.put('/api/finances/:id', (req, res) => {
  const { type, category, amount, description, transaction_date } = req.body;
  const sql = `
    UPDATE finances 
    SET type = ?, category = ?, amount = ?, description = ?, transaction_date = ? 
    WHERE id = ?
  `;

  pool.query(sql, [type, category, amount, description, transaction_date, req.params.id], (err, result) => {
    if (err) return handleError(res, err, 'Failed to update finance record');
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, error: 'Finance record not found' });
    }

    // Update summary
    updateFinanceSummary(transaction_date);
    broadcast('finances_updated', { id: req.params.id });
    handleSuccess(res, { id: req.params.id }, 'Finance record updated successfully');
  });
});

app.delete('/api/finances/:id', (req, res) => {
  // Get transaction date first for summary update
  pool.query('SELECT transaction_date FROM finances WHERE id = ?', [req.params.id], (err, results) => {
    if (err) return handleError(res, err, 'Failed to fetch finance record');
    if (results.length === 0) {
      return res.status(404).json({ success: false, error: 'Finance record not found' });
    }

    const transactionDate = results[0].transaction_date;

    pool.query('DELETE FROM finances WHERE id = ?', [req.params.id], (err) => {
      if (err) return handleError(res, err, 'Failed to delete finance record');

      // Update summary
      updateFinanceSummary(transactionDate);
      broadcast('finances_updated', { id: req.params.id, deleted: true });
      handleSuccess(res, null, 'Finance record deleted successfully');
    });
  });
});

app.get('/api/finances/summary', (req, res) => {
  // Ambil start_date dari query parameter, atau gunakan tanggal hari ini
  const startDate = req.query.start_date || new Date().toISOString().split('T')[0];

  const summarySQL = `
      SELECT 
        COALESCE(SUM(CASE WHEN type = 'masuk' THEN amount ELSE 0 END), 0) as total_income,
        COALESCE(SUM(CASE WHEN type = 'keluar' THEN amount ELSE 0 END), 0) as total_expense,
        COALESCE(SUM(CASE WHEN type = 'masuk' THEN amount ELSE -amount END), 0) as balance
      FROM finances 
      WHERE DATE(transaction_date) >= DATE(?)
    `;

  // GANTI 'connection' dengan nama variabel database Anda (misal: db)
  pool.query(summarySQL, [startDate], (err, results) => {
    if (err) {
      console.error('❌ Error calculating finance summary:', err.message);
      return res.status(500).json({ error: "Database error" });
    }

    const summary = results[0] || { total_income: 0, total_expense: 0, balance: 0 };
    res.status(200).json(summary);
  });
});

function updateFinanceSummary(date) {
  const summarySQL = `
    SELECT 
      COALESCE(SUM(CASE WHEN type = 'masuk' THEN amount ELSE 0 END), 0) as total_income,
      COALESCE(SUM(CASE WHEN type = 'keluar' THEN amount ELSE 0 END), 0) as total_expense,
      COALESCE(SUM(CASE WHEN type = 'masuk' THEN amount ELSE -amount END), 0) as balance
    FROM finances 
    WHERE DATE(transaction_date) = DATE(?)
  `;

  pool.query(summarySQL, [date], (err, results) => {
    if (err) {
      console.error('Error calculating finance summary:', err);
      return;
    }

    const summary = results[0] || { total_income: 0, total_expense: 0, balance: 0 };

    const insertSQL = `
      INSERT INTO finance_summary (date, total_income, total_expense, balance) 
      VALUES (?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE 
        total_income = VALUES(total_income),
        total_expense = VALUES(total_expense),
        balance = VALUES(balance),
        updated_at = CURRENT_TIMESTAMP
    `;

    pool.query(insertSQL, [date, summary.total_income, summary.total_expense, summary.balance], (err) => {
      if (err) {
        console.error('Error updating finance summary:', err);
      } else {
        broadcast('finance_summary_updated', { date });
      }
    });
  });
}

// ==================== HEALTH CHECK ====================
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
      websocket: clients.size + ' clients connected'
    });
  });
});

// ==================== STATIC FILES ====================
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ==================== 404 HANDLER ====================
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Route not found',
    path: req.path
  });
});

// ==================== ERROR HANDLER ====================
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    details: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

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
  console.log('Database Configuration:');
  console.log(`  - Host: ${dbConfig.host}`);
  console.log(`  - Database: ${dbConfig.database}`);
  console.log(`  - User: ${dbConfig.user}`);
  console.log('');
  console.log('Press Ctrl+C to stop the server');
  console.log('');

  // Launch browser in kiosk mode using dynamic import
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

// Graceful shutdown
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
// server.js - FIXED VERSION (UPDATED TO MATCH init-db.js)
const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const path = require('path');
const WebSocket = require('ws');
const http = require('http');
const multer = require('multer');
const fs = require('fs');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });
const JWT_SECRET = process.env.JWT_SECRET || 'masjid-al-ikhlas-secret-key-2024';
const JWT_EXPIRES = '24h';

// ==================== MIDDLEWARE ====================
app.use(cors());
app.use(express.json());
app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));

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

// Middleware untuk verifikasi JWT token
const authenticateToken = async (req, res, next) => {
    try {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

        if (!token) {
            return res.status(401).json({
                success: false,
                message: 'Akses ditolak. Token tidak ditemukan.'
            });
        }

        const decoded = jwt.verify(token, JWT_SECRET);

        // Verifikasi user masih aktif di database
        const [users] = await pool.promise().query(
            'SELECT id, username, email, full_name, role, is_active FROM users WHERE id = ?',
            [decoded.userId]
        );

        if (users.length === 0) {
            return res.status(401).json({
                success: false,
                message: 'User tidak ditemukan.'
            });
        }

        const user = users[0];

        if (!user.is_active) {
            return res.status(403).json({
                success: false,
                message: 'Akun Anda telah dinonaktifkan.'
            });
        }

        req.user = user;
        next();
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({
                success: false,
                message: 'Sesi telah berakhir. Silakan login kembali.'
            });
        }
        if (error.name === 'JsonWebTokenError') {
            return res.status(403).json({
                success: false,
                message: 'Token tidak valid.'
            });
        }
        return res.status(500).json({
            success: false,
            message: 'Terjadi kesalahan autentikasi.'
        });
    }
};

const requireAdmin = (req, res, next) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({
            success: false,
            message: 'Akses ditolak. Hanya admin yang diizinkan.'
        });
    }
    next();
};

const authRouter = express.Router();

authRouter.post('/register', async (req, res) => {
    const { username, password, email, full_name, role } = req.body;

    // 1. Validasi input
    if (!username || !password) {
        return res.status(400).json({
            success: false,
            message: 'Username dan password wajib diisi'
        });
    }

    if (password.length < 6) {
        return res.status(400).json({
            success: false,
            message: 'Password minimal 6 karakter'
        });
    }

    try {
        // 2. Cek apakah username sudah terdaftar
        const [existingUser] = await pool.promise().query(
            'SELECT id FROM users WHERE username = ? OR email = ?',
            [username, email || '']
        );

        if (existingUser.length > 0) {
            return res.status(400).json({
                success: false,
                message: 'Username atau email sudah digunakan'
            });
        }

        // 3. Enkripsi password
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        // 4. Simpan user baru
        const userRole = role || 'operator';
        const userFullName = full_name || username;

        const [result] = await pool.promise().query(
            'INSERT INTO users (username, email, password_hash, full_name, role) VALUES (?, ?, ?, ?, ?)',
            [username, email || null, hashedPassword, userFullName, userRole]
        );

        // 5. Kirim respon sukses
        res.status(201).json({
            success: true,
            message: 'User berhasil didaftarkan',
            data: {
                id: result.insertId,
                username,
                email: email || null,
                full_name: userFullName,
                role: userRole
            }
        });

    } catch (err) {
        console.error('Register error:', err);
        res.status(500).json({
            success: false,
            message: 'Terjadi kesalahan server saat mendaftar',
            error: err.message
        });
    }
});

authRouter.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        // Validasi input
        if (!username || !password) {
            return res.status(400).json({
                success: false,
                message: 'Username dan password wajib diisi.'
            });
        }

        // Cari user berdasarkan username atau email
        const [users] = await pool.promise().query(
            `SELECT id, username, email, password_hash, full_name, role, is_active 
       FROM users WHERE username = ? OR email = ?`,
            [username, username]
        );

        if (users.length === 0) {
            return res.status(401).json({
                success: false,
                message: 'Username atau password salah.'
            });
        }

        const user = users[0];

        // Cek akun aktif
        if (!user.is_active) {
            return res.status(403).json({
                success: false,
                message: 'Akun Anda telah dinonaktifkan.'
            });
        }

        // Verifikasi password
        const isValidPassword = await bcrypt.compare(password, user.password_hash);

        if (!isValidPassword) {
            return res.status(401).json({
                success: false,
                message: 'Username atau password salah.'
            });
        }

        // Update last login
        await pool.promise().query(
            'UPDATE users SET last_login = NOW() WHERE id = ?',
            [user.id]
        );

        // Generate JWT token
        const token = jwt.sign(
            {
                userId: user.id,
                username: user.username,
                role: user.role
            },
            JWT_SECRET,
            { expiresIn: JWT_EXPIRES }
        );

        // Kirim response
        res.json({
            success: true,
            message: 'Login berhasil.',
            data: {
                token,
                user: {
                    id: user.id,
                    username: user.username,
                    email: user.email,
                    full_name: user.full_name,
                    role: user.role
                }
            }
        });

    } catch (error) {
        console.error('Error logging in:', error);
        res.status(500).json({
            success: false,
            message: 'Terjadi kesalahan saat login.'
        });
    }
});

// POST /api/auth/logout - Logout user
authRouter.post('/logout', authenticateToken, (req, res) => {
    res.json({
        success: true,
        message: 'Logout berhasil.'
    });
});

// GET /api/auth/me - Get current user info
authRouter.get('/me', authenticateToken, async (req, res) => {
    try {
        const [users] = await pool.promise().query(
            'SELECT id, username, email, full_name, role, is_active, last_login, created_at FROM users WHERE id = ?',
            [req.user.id]
        );

        if (users.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'User tidak ditemukan.'
            });
        }

        res.json({
            success: true,
            data: users[0]
        });
    } catch (error) {
        console.error('Error fetching user:', error);
        res.status(500).json({
            success: false,
            message: 'Gagal mengambil data user.'
        });
    }
});

authRouter.put('/change-password', authenticateToken, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        const userId = req.user.id;

        if (!currentPassword || !newPassword) {
            return res.status(400).json({
                success: false,
                message: 'Password lama dan password baru wajib diisi.'
            });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({
                success: false,
                message: 'Password baru minimal 6 karakter.'
            });
        }

        // Ambil password hash
        const [users] = await pool.promise().query(
            'SELECT password_hash FROM users WHERE id = ?',
            [userId]
        );

        // Verifikasi password lama
        const isValid = await bcrypt.compare(currentPassword, users[0].password_hash);

        if (!isValid) {
            return res.status(401).json({
                success: false,
                message: 'Password lama tidak sesuai.'
            });
        }

        // Hash password baru
        const newHash = await bcrypt.hash(newPassword, 10);

        // Update password
        await pool.promise().query(
            'UPDATE users SET password_hash = ? WHERE id = ?',
            [newHash, userId]
        );

        res.json({
            success: true,
            message: 'Password berhasil diubah.'
        });

    } catch (error) {
        console.error('Error changing password:', error);
        res.status(500).json({
            success: false,
            message: 'Terjadi kesalahan saat mengubah password.'
        });
    }
});

authRouter.get('/users', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const [users] = await pool.promise().query(
            `SELECT id, username, email, full_name, role, is_active, last_login, created_at 
       FROM users ORDER BY created_at DESC`
        );

        res.json({
            success: true,
            data: users
        });

    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({
            success: false,
            message: 'Gagal mengambil data users.'
        });
    }
});

authRouter.put('/users/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { full_name, role, is_active } = req.body;

        // Cek user exists
        const [users] = await pool.promise().query(
            'SELECT id FROM users WHERE id = ?',
            [id]
        );

        if (users.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'User tidak ditemukan.'
            });
        }

        // Update user
        await pool.promise().query(
            `UPDATE users 
       SET full_name = ?, role = ?, is_active = ? 
       WHERE id = ?`,
            [full_name, role, is_active, id]
        );

        res.json({
            success: true,
            message: 'User berhasil diupdate.'
        });

    } catch (error) {
        console.error('Error updating user:', error);
        res.status(500).json({
            success: false,
            message: 'Gagal mengupdate user.'
        });
    }
});

authRouter.delete('/users/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;

        // Cek user exists
        const [users] = await pool.promise().query(
            'SELECT id FROM users WHERE id = ?',
            [id]
        );

        if (users.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'User tidak ditemukan.'
            });
        }

        // Jangan hapus diri sendiri
        if (parseInt(id) === req.user.id) {
            return res.status(400).json({
                success: false,
                message: 'Tidak dapat menghapus akun sendiri.'
            });
        }

        await pool.promise().query('DELETE FROM users WHERE id = ?', [id]);

        res.json({
            success: true,
            message: 'User berhasil dihapus.'
        });

    } catch (error) {
        console.error('Error deleting user:', error);
        res.status(500).json({
            success: false,
            message: 'Gagal menghapus user.'
        });
    }
});

// Mount routes
app.use('/api/auth', authRouter);

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

app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));

// Proteksi route admin (opsional - untuk serve static files)
app.use('/admin.html', authenticateToken, (req, res, next) => {
    next();
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

app.put('/api/settings/finance_display', authenticateToken, (req, res) => {
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

        // BROADCAST WEBSOCKET
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

app.put('/api/settings/:key', authenticateToken, (req, res) => {
    const { key } = req.params;
    const { setting_value } = req.body;

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

        // Broadcast perubahan
        broadcast('settings_updated', {
            key: key,
            value: setting_value
        });

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

// ==================== BULK SETTINGS ROUTE (UNTUK SAVE SETTINGS DI ADMIN) ====================
app.post('/api/settings/bulk', authenticateToken, (req, res) => {
    const { settings } = req.body;

    if (!Array.isArray(settings) || settings.length === 0) {
        return res.status(400).json({ success: false, error: 'Invalid settings data' });
    }

    // Mulai transaksi
    pool.getConnection((err, connection) => {
        if (err) {
            return handleError(res, err, 'Database connection failed');
        }

        connection.beginTransaction((err) => {
            if (err) {
                connection.release();
                return handleError(res, err, 'Failed to start transaction');
            }

            let completed = 0;
            let hasError = false;

            settings.forEach((setting) => {
                const sql = `
                    INSERT INTO settings (setting_key, setting_value) 
                    VALUES (?, ?) 
                    ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)
                `;

                connection.query(sql, [setting.key, setting.value], (err) => {
                    if (err && !hasError) {
                        hasError = true;
                        connection.rollback(() => {
                            connection.release();
                            handleError(res, err, 'Failed to update settings');
                        });
                        return;
                    }

                    completed++;
                    if (completed === settings.length && !hasError) {
                        connection.commit((err) => {
                            if (err) {
                                connection.rollback(() => {
                                    connection.release();
                                    handleError(res, err, 'Failed to commit transaction');
                                });
                                return;
                            }

                            connection.release();
                            broadcast('settings_updated', settings);
                            handleSuccess(res, settings, 'Settings updated successfully');
                        });
                    }
                });
            });
        });
    });
});

// ==================== HIJRI DATE CACHE ROUTE ====================
app.get('/api/settings/hijri_date_cache', (req, res) => {
    const sql = 'SELECT setting_value FROM settings WHERE setting_key = "hijri_date_cache"';

    pool.query(sql, (err, results) => {
        if (err) {
            console.error('❌ Error fetching hijri date cache:', err);
            return res.status(500).json({ 
                success: false, 
                error: 'Database error',
                message: err.message 
            });
        }

        if (results.length === 0) {
            // Return default value if not found
            return res.json({
                success: true,
                data: {
                    setting_key: 'hijri_date_cache',
                    setting_value: '1 Muharram 1445 H' // Default value
                }
            });
        }

        res.json({
            success: true,
            data: {
                setting_key: 'hijri_date_cache',
                setting_value: results[0].setting_value
            }
        });
    });
});

app.put('/api/settings/hijri_date_cache', authenticateToken, (req, res) => {
    const { value } = req.body;

    if (!value) {
        return res.status(400).json({ 
            success: false, 
            error: 'Value is required' 
        });
    }

    const sql = `
        INSERT INTO settings (setting_key, setting_value) 
        VALUES ('hijri_date_cache', ?)
        ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), updated_at = CURRENT_TIMESTAMP
    `;

    pool.query(sql, [value], (err, result) => {
        if (err) {
            console.error('❌ Error saving hijri date cache:', err);
            return res.status(500).json({ 
                success: false, 
                error: 'Database error',
                message: err.message 
            });
        }

        res.json({
            success: true,
            message: 'Hijri date saved successfully',
            data: {
                setting_key: 'hijri_date_cache',
                setting_value: value
            }
        });
    });
});

// ==================== RUNNING TEXT ROUTES (PROTECTED) ====================
app.post('/api/running-text', authenticateToken, (req, res) => {
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

app.put('/api/running-text/:id', authenticateToken, (req, res) => {
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

// ==================== CONTENT ROUTES (PROTECTED) ====================
app.post('/api/content', authenticateToken, (req, res) => {
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

app.put('/api/content/:id', authenticateToken, (req, res) => {
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

// ==================== IQOMAH RUNNING TEXT ROUTES (PROTECTED) ====================
app.post('/api/iqomah-running-text', authenticateToken, (req, res) => {
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

app.put('/api/iqomah-running-text/:id', authenticateToken, (req, res) => {
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

// ==================== EVENTS ROUTES (PROTECTED) ====================
app.post('/api/events', authenticateToken, (req, res) => {
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

app.put('/api/events/:id', authenticateToken, (req, res) => {
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

// ==================== FINANCES ROUTES (PROTECTED) ====================
app.post('/api/finances', authenticateToken, (req, res) => {
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

app.put('/api/finances/:id', authenticateToken, (req, res) => {
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

// ==================== DELETE ROUTES (PROTECTED) ====================
app.delete('/api/running-text/:id', authenticateToken, (req, res) => {
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

app.delete('/api/iqomah-running-text/:id', authenticateToken, (req, res) => {
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

app.delete('/api/events/:id', authenticateToken, (req, res) => {
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

app.delete('/api/content/:id', authenticateToken, (req, res) => {
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

app.delete('/api/finances/:id', authenticateToken, (req, res) => {
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

app.put('/api/prayer-times/:id', authenticateToken, (req, res) => {
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

app.post('/api/prayer-times/bulk', authenticateToken, (req, res) => {
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

app.put('/api/ramadhan-mode', authenticateToken, (req, res) => {
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

    // Ini hanya contoh, seharusnya berdasarkan data dari API atau database
    if (month === 3) { // Maret sebagai contoh
        return true;
    }

    return false;
}

// Helper functions untuk auto-update jadwal shalat
// Helper functions untuk auto-update jadwal shalat
async function getLastUpdateDate() {
    return new Promise((resolve, reject) => {
        pool.query(
            'SELECT setting_value FROM settings WHERE setting_key = "last_prayer_update"',
            (err, results) => {
                if (err) return reject(err);
                if (results.length === 0) return resolve(null);
                resolve(results[0].setting_value);
            }
        );
    });
}

async function saveLastUpdateDate(date) {
    return new Promise((resolve, reject) => {
        pool.query(
            `INSERT INTO settings (setting_key, setting_value) 
             VALUES ('last_prayer_update', ?)
             ON DUPLICATE KEY UPDATE setting_value = ?`,
            [date, date],
            (err) => {
                if (err) return reject(err);
                resolve();
            }
        );
    });
}

async function getPrayerTimesFromDB() {
    return new Promise((resolve, reject) => {
        pool.query(
            'SELECT prayer_name, time FROM prayer_times',
            (err, results) => {
                if (err) return reject(err);
                resolve(results);
            }
        );
    });
}

async function updatePrayerTimesInDB(prayers) {
    return new Promise((resolve, reject) => {
        let completed = 0;
        let hasError = false;
        
        prayers.forEach((prayer) => {
            pool.query(
                'UPDATE prayer_times SET time = ? WHERE prayer_name = ?',
                [prayer.time, prayer.prayer_name],
                (err) => {
                    if (err && !hasError) {
                        hasError = true;
                        return reject(err);
                    }
                    completed++;
                    if (completed === prayers.length && !hasError) {
                        resolve();
                    }
                }
            );
        });
    });
}

async function fetchFromAladhanAPI() {
    const latitude = -6.9419; // Bandung
    const longitude = 107.6824;
    const method = 11; // Kemenag RI
    
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth() + 1;
    
    const url = `https://api.aladhan.com/v1/calendar/${year}/${month}?latitude=${latitude}&longitude=${longitude}&method=${method}`;
    
    try {
        const response = await fetch(url);
        const data = await response.json();
        
        const day = today.getDate();
        const timings = data.data[day - 1].timings;
        
        // Mapping dari nama API ke nama database
        const prayerMapping = {
            'Fajr': 'Subuh',
            'Sunrise': 'Terbit',
            'Dhuhr': 'Dzuhur',
            'Asr': 'Ashar',
            'Maghrib': 'Maghrib',
            'Isha': 'Isya'
        };
        
        const prayers = [];
        for (const [apiName, dbName] of Object.entries(prayerMapping)) {
            if (timings[apiName]) {
                const timeStr = timings[apiName].split(' ')[0];
                prayers.push({
                    prayer_name: dbName,
                    time: timeStr.substring(0, 5)
                });
            }
        }
        
        return prayers;
    } catch (error) {
        console.error('❌ Gagal mengambil data dari API Aladhan:', error.message);
        return null;
    }
}

async function saveLastUpdateDate(date) {
    return new Promise((resolve, reject) => {
        pool.query(
            `INSERT INTO settings (setting_key, setting_value) 
             VALUES ('last_prayer_update', ?)
             ON DUPLICATE KEY UPDATE setting_value = ?`,
            [date, date],
            (err) => {
                if (err) return reject(err);
                resolve();
            }
        );
    });
}

async function getPrayerTimesFromDB() {
    return new Promise((resolve, reject) => {
        pool.query(
            'SELECT prayer_name, time FROM prayer_times',
            (err, results) => {
                if (err) return reject(err);
                resolve(results);
            }
        );
    });
}

async function updatePrayerTimesInDB(prayers) {
    return new Promise((resolve, reject) => {
        let completed = 0;
        let hasError = false;
        
        prayers.forEach((prayer) => {
            pool.query(
                'UPDATE prayer_times SET time = ? WHERE prayer_name = ?',
                [prayer.time, prayer.prayer_name],
                (err) => {
                    if (err && !hasError) {
                        hasError = true;
                        return reject(err);
                    }
                    completed++;
                    if (completed === prayers.length && !hasError) {
                        resolve();
                    }
                }
            );
        });
    });
}

async function fetchFromAladhanAPI() {
    const latitude = -6.9419; // Bandung
    const longitude = 107.6824;
    const method = 11; // Kemenag RI
    
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth() + 1;
    
    const url = `https://api.aladhan.com/v1/calendar/${year}/${month}?latitude=${latitude}&longitude=${longitude}&method=${method}`;
    
    try {
        const response = await fetch(url);
        const data = await response.json();
        
        const day = today.getDate();
        const timings = data.data[day - 1].timings;
        
        // Mapping dari nama API ke nama database
        const prayerMapping = {
            'Fajr': 'Subuh',
            'Sunrise': 'Terbit',
            'Dhuhr': 'Dzuhur',
            'Asr': 'Ashar',
            'Maghrib': 'Maghrib',
            'Isha': 'Isya'
        };
        
        const prayers = [];
        for (const [apiName, dbName] of Object.entries(prayerMapping)) {
            if (timings[apiName]) {
                const timeStr = timings[apiName].split(' ')[0];
                prayers.push({
                    prayer_name: dbName,
                    time: timeStr.substring(0, 5)
                });
            }
        }
        
        return prayers;
    } catch (error) {
        console.error('❌ Gagal mengambil data dari API Aladhan:', error.message);
        return null;
    }
}

// ==================== IQOMAH TIMES ROUTES ====================
app.get('/api/iqomah-times', (req, res) => {
    const sql = 'SELECT id, prayer_name, minutes, updated_at FROM iqomah_times ORDER BY id';

    pool.query(sql, (err, results) => {
        if (err) return handleError(res, err, 'Failed to fetch iqomah times');
        handleSuccess(res, results);
    });
});

app.put('/api/iqomah-times/:id', authenticateToken, (req, res) => {
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

// ==================== RUNNING TEXT ROUTES (PUBLIC) ====================
app.get('/api/running-text', (req, res) => {
    const sql = 'SELECT id, text, font_family, font_size, speed, is_active, created_at FROM running_text WHERE is_active = 1 ORDER BY id';

    pool.query(sql, (err, results) => {
        if (err) return handleError(res, err, 'Failed to fetch running texts');
        handleSuccess(res, results);
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

// ==================== IQOMAH RUNNING TEXT ROUTES (PUBLIC) ====================
app.get('/api/iqomah-running-text', (req, res) => {
    const sql = 'SELECT id, text, font_family, font_size, speed, is_active, display_order, created_at FROM iqomah_running_text WHERE is_active = 1 ORDER BY display_order, id';

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

// ==================== CONTENT ROUTES (PUBLIC) ====================
app.get('/api/content', (req, res) => {
    const sql = 'SELECT id, title, content_text, content_type, image_url, video_url, display_order, is_active, created_at, updated_at FROM content WHERE is_active = 1 ORDER BY display_order, id';

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

// ==================== EVENTS ROUTES (PUBLIC) ====================
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

// ==================== FINANCES ROUTES (PUBLIC) ====================
app.get('/api/finances', (req, res) => {
    const { start_date, end_date, type, limit } = req.query;
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

    if (limit) {
        sql += ' LIMIT ?';
        params.push(parseInt(limit));
    }

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

app.get('/api/finances/summary', (req, res) => {
    const { start_date, end_date } = req.query;
    
    let sql = `
        SELECT 
            DATE(transaction_date) as date,
            COALESCE(SUM(CASE WHEN type = 'masuk' THEN amount ELSE 0 END), 0) as total_income,
            COALESCE(SUM(CASE WHEN type = 'keluar' THEN amount ELSE 0 END), 0) as total_expense,
            COALESCE(SUM(CASE WHEN type = 'masuk' THEN amount ELSE -amount END), 0) as balance
        FROM finances
    `;
    
    const params = [];
    
    if (start_date || end_date) {
        sql += ' WHERE 1=1';
        
        if (start_date) {
            sql += ' AND DATE(transaction_date) >= DATE(?)';
            params.push(start_date);
        }
        
        if (end_date) {
            sql += ' AND DATE(transaction_date) <= DATE(?)';
            params.push(end_date);
        }
    }
    
    sql += ' GROUP BY DATE(transaction_date) ORDER BY date DESC';

    pool.query(sql, params, (err, results) => {
        if (err) {
            console.error('❌ Error calculating finance summary:', err);
            return res.status(500).json({ 
                success: false, 
                error: 'Failed to fetch finance summary',
                details: err.message 
            });
        }

        // Jika tidak ada data, kirim array kosong
        if (!results || results.length === 0) {
            return res.json({
                success: true,
                data: []
            });
        }

        res.json({
            success: true,
            data: results
        });
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

// ==================== UPLOAD ROUTE ====================
app.post('/api/upload', authenticateToken, (req, res) => {
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

async function autoUpdatePrayerTimesOnStartup() {
    try {
        console.log('🔄 Checking for prayer time updates from API...');
        
        const today = new Date().toISOString().split('T')[0];
        const lastUpdate = await getLastUpdateDate();
        
        if (lastUpdate === today) {
            console.log('✅ Jadwal sudah update hari ini, skip auto-update');
            return;
        }
        
        const apiPrayers = await fetchFromAladhanAPI();
        if (!apiPrayers) {
            console.log('⚠️ Gagal mengambil data dari API, skip auto-update');
            return;
        }
        
        const dbPrayers = await getPrayerTimesFromDB();
        
        let hasChanges = false;
        for (const apiPrayer of apiPrayers) {
            const dbPrayer = dbPrayers.find(p => p.prayer_name === apiPrayer.prayer_name);
            if (dbPrayer && dbPrayer.time !== apiPrayer.time) {
                hasChanges = true;
                console.log(`📝 Perubahan terdeteksi: ${apiPrayer.prayer_name} ${dbPrayer.time} → ${apiPrayer.time}`);
                break;
            }
        }
        
        if (hasChanges) {
            console.log('📝 Ada perubahan jadwal, update database...');
            await updatePrayerTimesInDB(apiPrayers);
            await saveLastUpdateDate(today);
            broadcast('prayer_times_updated', apiPrayers);
            console.log('✅ Jadwal shalat berhasil diupdate');
        } else {
            console.log('✅ Tidak ada perubahan jadwal');
            await saveLastUpdateDate(today);
        }
    } catch (error) {
        console.error('❌ Error in autoUpdatePrayerTimesOnStartup:', error.message);
    }
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

// ==================== GOOGLE SHEETS INTEGRATION ====================
const { google } = require('googleapis');

const CREDENTIALS_PATH = path.join(__dirname, 'masjid-al-ikhlas-sync-100beb194a63.json');
// ID Google Sheet (ambil dari URL sheet)
const SPREADSHEET_ID = process.env.GOOGLE_SHEET_ID || '1mMsUObQ79l3w6lL4q9Cj_xYSo1DJr46J5b2J3y9IdsQ'; 
// Nama sheet/tab tujuan
const SHEET_NAME = 'Laporan Keuangan';

// Fungsi autentikasi ke Google API
async function getGoogleAuth() {
    try {
        const credentials = JSON.parse(fs.readFileSync(CREDENTIALS_PATH, 'utf8'));
        
        const auth = new google.auth.JWT({
            email: credentials.client_email,
            key: credentials.private_key,
            scopes: [
                'https://www.googleapis.com/auth/spreadsheets',
                'https://www.googleapis.com/auth/drive'
            ]
        });
        
        return auth;
    } catch (error) {
        console.error('❌ Error loading Google credentials:', error.message);
        return null;
    }
}

// Endpoint untuk sync data keuangan ke Google Sheet
app.post('/api/sync-to-google-sheet', authenticateToken, async (req, res) => {
    try {
        console.log('📤 Menyinkronkan data ke Google Sheet...');
        
        // 1. Ambil data dari database
        const [transactions] = await pool.promise().query(`
            SELECT 
                DATE(transaction_date) as tanggal,
                type,
                category,
                amount,
                description,
                created_at
            FROM finances 
            ORDER BY transaction_date DESC
        `);
        
        if (transactions.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Tidak ada data keuangan untuk disinkronkan'
            });
        }
        
        // 2. Format data untuk Google Sheets (Array of Arrays)
        const header = ['Tanggal', 'Tipe', 'Kategori', 'Jumlah (Rp)', 'Deskripsi', 'Waktu Input'];
        const rows = transactions.map(t => [
            t.tanggal,
            t.type === 'masuk' ? 'Pemasukan' : 'Pengeluaran',
            t.category,
            parseInt(t.amount).toLocaleString('id-ID'),
            t.description || '-',
            new Date(t.created_at).toLocaleString('id-ID')
        ]);
        
        const dataToWrite = [header, ...rows];
        
        // 3. Autentikasi ke Google API
        const auth = await getGoogleAuth();
        if (!auth) {
            throw new Error('Gagal autentikasi ke Google API');
        }
        
        const sheets = google.sheets({ version: 'v4', auth });
        
        // 4. Cek apakah sheet sudah ada, jika belum buat
        try {
            await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
        } catch (error) {
            // Sheet tidak ditemukan
            return res.status(400).json({
                success: false,
                message: 'Google Sheet tidak ditemukan. Pastikan SPREADSHEET_ID benar dan service account memiliki akses.'
            });
        }
        
        // 5. Clear data yang ada
        await sheets.spreadsheets.values.clear({
            spreadsheetId: SPREADSHEET_ID,
            range: `${SHEET_NAME}!A:F`
        });
        
        // 6. Tulis data baru
        await sheets.spreadsheets.values.update({
            spreadsheetId: SPREADSHEET_ID,
            range: `${SHEET_NAME}!A1`,
            valueInputOption: 'USER_ENTERED',
            requestBody: { values: dataToWrite }
        });
        
        console.log(`✅ Synced ${transactions.length} records to Google Sheet`);
        
        res.json({
            success: true,
            message: `Berhasil sync ${transactions.length} transaksi ke Google Sheet`,
            sheetId: SPREADSHEET_ID,
            totalSynced: transactions.length
        });
        
    } catch (error) {
        console.error('❌ Error syncing to Google Sheet:', error);
        res.status(500).json({
            success: false,
            message: 'Gagal sync ke Google Sheet: ' + error.message
        });
    }
});

// Endpoint untuk cek status koneksi Google Sheet
app.get('/api/google-sheet-status', authenticateToken, async (req, res) => {
    try {
        const auth = await getGoogleAuth();
        if (!auth) {
            return res.json({ success: false, connected: false, error: 'Auth failed' });
        }
        
        const sheets = google.sheets({ version: 'v4', auth });
        
        const metadata = await sheets.spreadsheets.get({
            spreadsheetId: SPREADSHEET_ID,
            fields: 'properties.title,sheets.properties'
        });
        
        res.json({
            success: true,
            connected: true,
            sheetTitle: metadata.data.properties.title,
            sheetUrl: `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}`
        });
        
    } catch (error) {
        console.error('Error checking Google Sheet status:', error);
        res.json({ 
            success: false, 
            connected: false, 
            error: error.message 
        });
    }
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
    
    // Jalankan auto-update jadwal shalat
    try {
        await autoUpdatePrayerTimesOnStartup();
    } catch (error) {
        console.error('❌ Auto-update jadwal shalat gagal:', error.message);
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
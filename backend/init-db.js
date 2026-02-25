const mysql = require('mysql2');
const bcrypt = require('bcryptjs');

// Database Connection
const connection = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: '',
  multipleStatements: true // Penting untuk menjalankan banyak query sekaligus
});

console.log('🔧 Starting database initialization...');

// Connect to MySQL
connection.connect((err) => {
  if (err) {
    console.error('❌ Error connecting to MySQL:', err.message);
    console.log('💡 Please make sure:');
    console.log('   1. MySQL is running');
    console.log('   2. Username and password are correct');
    process.exit(1);
  }

  console.log('✅ Connected to MySQL');
  createDatabase();
});

function createDatabase() {
  console.log('📦 Creating database...');

  connection.query('CREATE DATABASE IF NOT EXISTS masjid_db', (err) => {
    if (err) {
      console.error('❌ Error creating database:', err.message);
      process.exit(1);
    }

    console.log('✅ Database "masjid_db" created');
    connection.query('USE masjid_db', (err) => {
      if (err) {
        console.error('❌ Error selecting database:', err.message);
        process.exit(1);
      }
      createTables();
    });
  });
}

function createTables() {
  console.log('🔨 Creating tables...');

  const createTablesSQL = `
    CREATE TABLE IF NOT EXISTS settings (
      setting_key VARCHAR(100) PRIMARY KEY,
      setting_value TEXT NOT NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    
    CREATE TABLE IF NOT EXISTS prayer_times (
      id INT PRIMARY KEY AUTO_INCREMENT,
      prayer_name VARCHAR(50) NOT NULL UNIQUE,
      time TIME NOT NULL,
      ihtiyat INT DEFAULT 0,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    
    CREATE TABLE IF NOT EXISTS iqomah_times (
      id INT PRIMARY KEY AUTO_INCREMENT,
      prayer_name VARCHAR(50) NOT NULL UNIQUE,
      minutes INT NOT NULL DEFAULT 10,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    
    CREATE TABLE IF NOT EXISTS running_text (
      id INT PRIMARY KEY AUTO_INCREMENT,
      text TEXT NOT NULL,
      font_family VARCHAR(100) DEFAULT 'Inter',
      font_size INT DEFAULT 16,
      speed INT DEFAULT 30,
      is_active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

      CREATE TABLE IF NOT EXISTS iqomah_running_text (
      id INT PRIMARY KEY AUTO_INCREMENT,
      text TEXT NOT NULL,
      font_family VARCHAR(100) DEFAULT 'Inter',
      font_size INT DEFAULT 16,
      speed INT DEFAULT 30,
      is_active BOOLEAN DEFAULT TRUE,
      display_order INT DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    
    CREATE TABLE IF NOT EXISTS content (
      id INT PRIMARY KEY AUTO_INCREMENT,
      title VARCHAR(255) NOT NULL,
      content_text TEXT,
      content_type ENUM('text', 'image', 'video', 'announcement') DEFAULT 'text',
      image_url VARCHAR(500),
      video_url VARCHAR(500),
      display_order INT DEFAULT 0,
      is_active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    
    CREATE TABLE IF NOT EXISTS events (
      id INT PRIMARY KEY AUTO_INCREMENT,
      title VARCHAR(255) NOT NULL,
      description TEXT,
      target_date DATETIME NOT NULL,
      is_active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    
    CREATE TABLE IF NOT EXISTS finances (
      id INT PRIMARY KEY AUTO_INCREMENT,
      type ENUM('masuk', 'keluar') NOT NULL,
      category VARCHAR(100) NOT NULL,
      amount DECIMAL(15,2) NOT NULL,
      description TEXT,
      transaction_date DATE NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    
    CREATE TABLE IF NOT EXISTS finance_summary (
      id INT PRIMARY KEY AUTO_INCREMENT,
      date DATE UNIQUE NOT NULL,
      total_income DECIMAL(15,2) DEFAULT 0,
      total_expense DECIMAL(15,2) DEFAULT 0,
      balance DECIMAL(15,2) DEFAULT 0,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS users (
      id INT PRIMARY KEY AUTO_INCREMENT,
      username VARCHAR(50) UNIQUE NOT NULL,
      email VARCHAR(100) UNIQUE,
      password_hash VARCHAR(255) NOT NULL,
      full_name VARCHAR(100),
      role ENUM('admin', 'operator') DEFAULT 'operator',
      is_active BOOLEAN DEFAULT TRUE,
      last_login TIMESTAMP NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;    
  `;

  connection.query(createTablesSQL, (err) => {
    if (err) {
      console.error('❌ Error creating tables:', err.message);
      process.exit(1);
    }

    console.log('✅ All tables created successfully');
    insertDefaultData();
  });
}

function insertDefaultData() {
  console.log('📝 Inserting default data...');

  // Begin transaction
  connection.beginTransaction((err) => {
    if (err) {
      console.error('❌ Error starting transaction:', err.message);
      process.exit(1);
    }

    // Default settings
    const defaultSettings = [
      ['masjid_name', 'MASJID AL-IKHLAS'],
      ['masjid_address', 'Jl. Riung Wulan No. 01'],
      ['latitude', '-6.9419'],
      ['longitude', '107.6824'],
      ['prayer_calculation_method', '11'],
      ['timezone', 'Asia/Jakarta'],
      ['auto_adzan', '1'],
      ['adzan_volume', '80'],
      ['iqomah_default', '10'],
      ['display_rotation', '20'],
      ['date_rotation', '15'],
      ['hijri_date_cache', '1 Muharram 1445 H'],
      ['chart_rotation', '25'],
      ['adzan_redirect_minutes', '5'],
      ['finance_display', '1'],
      ['iqomah_duration', '10']
    ];

    const defaultUsers = [
      ['admin', 'admin@masjid.local', 'admin123', 'Administrator', 'admin']
    ];

    const insertUserSQL = 'INSERT IGNORE INTO users (username, email, password_hash, full_name, role) VALUES ?';

    const bcrypt = require('bcryptjs');
    const saltRounds = 10;

    const userPromises = defaultUsers.map(async ([username, email, password, full_name, role]) => {
      const hashedPassword = await bcrypt.hash(password, saltRounds);
      return [username, email, hashedPassword, full_name, role];
    });

    Promise.all(userPromises).then((userValues) => {
      connection.query(insertUserSQL, [userValues], (err) => {
        if (err) {
          console.error('❌ Error inserting admin user:', err.message);
          // Lanjutkan meskipun error (mungkin user sudah ada)
        } else {
          console.log('✅ Admin user created (username: admin, password: admin123)');
        }
        checkCompletion();
      });
    }).catch(err => {
      console.error('❌ Error hashing password:', err);
      checkCompletion();
    });

    let completedQueries = 0;
    const totalQueries = 8; // Number of insert operations

    function checkCompletion() {
      completedQueries++;
      if (completedQueries === totalQueries) {
        connection.commit((err) => {
          if (err) {
            console.error('❌ Error committing transaction:', err.message);
            connection.rollback(() => {
              process.exit(1);
            });
            return;
          }

          console.log('🎉 Database initialization completed successfully!');
          console.log('');
          console.log('✅ You can now run: npm start');
          connection.end();
        });
      }
    }

    // Insert settings
    const insertSettingsSQL = 'INSERT IGNORE INTO settings (setting_key, setting_value) VALUES ?';
    connection.query(insertSettingsSQL, [defaultSettings], (err) => {
      if (err) {
        console.error('❌ Error inserting settings:', err.message);
        connection.rollback(() => process.exit(1));
        return;
      }
      console.log(`✅ ${defaultSettings.length} settings inserted`);
      checkCompletion();
    });

    // Default prayer times
    const defaultPrayers = [
      ['Subuh', '04:15:00', 3],
      ['Terbit', '05:30:00', -7],
      ['Dzuhur', '11:45:00', 3],
      ['Ashar', '15:00:00', 2],
      ['Maghrib', '17:50:00', 2],
      ['Isya', '19:05:00', 3]
    ];

    const insertPrayersSQL = 'INSERT IGNORE INTO prayer_times (prayer_name, time, ihtiyat) VALUES ?';
    connection.query(insertPrayersSQL, [defaultPrayers], (err) => {
      if (err) {
        console.error('❌ Error inserting prayer times:', err.message);
        connection.rollback(() => process.exit(1));
        return;
      }
      console.log(`✅ ${defaultPrayers.length} prayer times inserted`);
      checkCompletion();
    });

    // Default iqomah
    const defaultIqomah = [
      ['Subuh', 10],
      ['Dzuhur', 10],
      ['Ashar', 10],
      ['Maghrib', 10],
      ['Isya', 10]
    ];

    const insertIqomahSQL = 'INSERT IGNORE INTO iqomah_times (prayer_name, minutes) VALUES ?';
    connection.query(insertIqomahSQL, [defaultIqomah], (err) => {
      if (err) {
        console.error('❌ Error inserting iqomah times:', err.message);
        connection.rollback(() => process.exit(1));
        return;
      }
      console.log(`✅ ${defaultIqomah.length} iqomah times inserted`);
      checkCompletion();
    });

    // Default running texts
    const runningTexts = [
      ['Selamat datang di Masjid Al-Ikhlas', 'Inter', 16, 30, 1],
      ['Jaga kebersihan dan ketertiban masjid', 'Inter', 16, 30, 1],
      ['Mari rapatkan dan luruskan shaf shalat', 'Inter', 16, 30, 1]
    ];

    const insertRunningTextSQL = 'INSERT INTO running_text (text, font_family, font_size, speed, is_active) VALUES ?';
    connection.query(insertRunningTextSQL, [runningTexts], (err) => {
      if (err) {
        console.error('❌ Error inserting running text:', err.message);
        connection.rollback(() => process.exit(1));
        return;
      }
      console.log('✅ Running texts inserted');
      checkCompletion();
    });

    // Default event
    const nextMonth = new Date();
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    const eventDate = nextMonth.toISOString().slice(0, 19).replace('T', ' ');

    const sql = 'INSERT INTO events (title, description, target_date, is_active) VALUES (?, ?, ?, 1)';
    connection.query(sql, ['Maulid Nabi Muhammad SAW', 'Peringatan Maulid Nabi Besar Muhammad SAW', eventDate], (err) => {
      if (err) {
        console.error('❌ Error inserting event:', err.message);
        connection.rollback(() => process.exit(1));
        return;
      }
      console.log('✅ Default event inserted');
      checkCompletion();
    });

    // Default finances
    const finances = [
      ['masuk', 'Infaq Jumat', 2500000, 'Infaq Jumat', new Date().toISOString().split('T')[0]],
      ['keluar', 'Listrik', 850000, 'Pembayaran listrik bulanan', new Date().toISOString().split('T')[0]],
      ['masuk', 'Zakat Fitrah', 1500000, 'Zakat fitrah Ramadan', new Date().toISOString().split('T')[0]]
    ];

    const insertFinancesSQL = 'INSERT INTO finances (type, category, amount, description, transaction_date) VALUES ?';
    connection.query(insertFinancesSQL, [finances], (err) => {
      if (err) {
        console.error('❌ Error inserting finances:', err.message);
        connection.rollback(() => process.exit(1));
        return;
      }
      console.log(`✅ ${finances.length} finance records inserted`);
      checkCompletion();
    });

    // Update finance summary
    const today = new Date().toISOString().split('T')[0];
    const summarySQL = `
      SELECT 
        COALESCE(SUM(CASE WHEN type = 'masuk' THEN amount ELSE 0 END), 0) as total_income,
        COALESCE(SUM(CASE WHEN type = 'keluar' THEN amount ELSE 0 END), 0) as total_expense,
        COALESCE(SUM(CASE WHEN type = 'masuk' THEN amount ELSE -amount END), 0) as balance
      FROM finances 
      WHERE DATE(transaction_date) = DATE(?)
    `;

    connection.query(summarySQL, [today], (err, results) => {
      if (err) {
        console.error('❌ Error calculating finance summary:', err.message);
        checkCompletion();
        return;
      }

      const summary = results[0] || { total_income: 0, total_expense: 0, balance: 0 };

      const insertSQL = `
        INSERT INTO finance_summary (date, total_income, total_expense, balance) 
        VALUES (?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE 
          total_income = VALUES(total_income),
          total_expense = VALUES(total_expense),
          balance = VALUES(balance)
      `;

      connection.query(insertSQL, [today, summary.total_income, summary.total_expense, summary.balance], (err) => {
        if (err) {
          console.error('❌ Error inserting finance summary:', err.message);
        } else {
          console.log('✅ Finance summary updated');
        }
        checkCompletion();
      });
    });
  });
}
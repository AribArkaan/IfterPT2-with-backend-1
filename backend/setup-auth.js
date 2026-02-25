const bcrypt = require('bcrypt');
const { pool } = require('./config/database');

/**
 * Setup script to create users table and default admin user
 * Run this once: node setup-auth.js
 */

async function setupAuth() {
  console.log('🔐 Setting up authentication...\n');

  // Create users table
  const createTableSQL = `
    CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      username VARCHAR(50) UNIQUE NOT NULL,
      email VARCHAR(100) UNIQUE NOT NULL,
      password VARCHAR(255) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_username (username),
      INDEX idx_email (email)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `;

  pool.query(createTableSQL, (err) => {
    if (err) {
      console.error('❌ Error creating users table:', err);
      process.exit(1);
    }

    console.log('✅ Users table created/verified');

    // Create default admin user
    const defaultUsername = 'admin';
    const defaultPassword = 'admin123';
    const defaultEmail = 'admin@masjid.local';

    // Check if admin already exists
    pool.query('SELECT id FROM users WHERE username = ?', [defaultUsername], async (err, results) => {
      if (err) {
        console.error('❌ Error checking for existing admin:', err);
        process.exit(1);
      }

      if (results.length > 0) {
        console.log('ℹ️  Admin user already exists');
        console.log('\n📝 Default credentials:');
        console.log(`   Username: ${defaultUsername}`);
        console.log(`   Password: ${defaultPassword}`);
        console.log('\n⚠️  CHANGE THIS PASSWORD IN PRODUCTION!\n');
        pool.end();
        process.exit(0);
      }

      // Hash password
      try {
        const hashedPassword = await bcrypt.hash(defaultPassword, 10);

        // Insert admin user
        pool.query(
          'INSERT INTO users (username, email, password) VALUES (?, ?, ?)',
          [defaultUsername, defaultEmail, hashedPassword],
          (err, result) => {
            if (err) {
              console.error('❌ Error creating admin user:', err);
              process.exit(1);
            }

            console.log('✅ Default admin user created\n');
            console.log('📝 Default credentials:');
            console.log(`   Username: ${defaultUsername}`);
            console.log(`   Password: ${defaultPassword}`);
            console.log(`   Email: ${defaultEmail}`);
            console.log('\n⚠️  CHANGE THIS PASSWORD IN PRODUCTION!\n');

            pool.end();
            process.exit(0);
          }
        );
      } catch (err) {
        console.error('❌ Error hashing password:', err);
        process.exit(1);
      }
    });
  });
}

setupAuth();

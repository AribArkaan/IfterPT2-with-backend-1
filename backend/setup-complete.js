#!/usr/bin/env node

// Quick setup script for authentication system
// Run: npm run setup-auth

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('\n🔐 Setting up Authentication System...\n');

// Step 1: Check if all files exist
const requiredFiles = [
  'config/session.js',
  'config/database.js',
  'middleware/auth.js',
  'controllers/authController.js',
  'routes/auth.js',
  'setup-auth.js',
  'public/login.html',
  'public/auth-helper.js'
];

console.log('📋 Checking required files...');
let allFilesExist = true;
requiredFiles.forEach(file => {
  const filePath = path.join(__dirname, file);
  if (fs.existsSync(filePath)) {
    console.log(`  ✅ ${file}`);
  } else {
    console.log(`  ❌ ${file} (MISSING)`);
    allFilesExist = false;
  }
});

if (!allFilesExist) {
  console.error('\n❌ Some required files are missing!');
  process.exit(1);
}

console.log('\n✅ All files found\n');

// Step 2: Run the auth setup
console.log('🏗️  Creating users table and default admin user...\n');
try {
  const setupPath = path.join(__dirname, 'setup-auth.js');
  execSync(`node ${setupPath}`, { stdio: 'inherit' });
} catch (error) {
  console.error('❌ Setup failed:', error.message);
  process.exit(1);
}

console.log('\n✅ Authentication setup complete!\n');
console.log('📝 Next steps:');
console.log('  1. npm start         - Start the server');
console.log('  2. Open http://localhost:3000');
console.log('  3. Login with admin/admin123\n');

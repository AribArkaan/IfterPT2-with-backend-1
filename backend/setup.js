// backend/setup.js
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🔄 Setup Sistem Masjid...');

// Install dependencies
console.log('📦 Menginstall dependencies...');
exec('npm install', (error, stdout, stderr) => {
  if (error) {
    console.error('❌ Gagal install dependencies:', error);
    return;
  }
  
  console.log('✅ Dependencies terinstall');
  
  // Buat file .env jika belum ada
  const envFile = path.join(__dirname, '.env');
  if (!fs.existsSync(envFile)) {
    const envContent = `# Database Configuration
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=
DB_NAME=masjid_db
DB_PORT=3306

# Server Configuration
PORT=3000
NODE_ENV=development

# API Configuration
ALADHAN_API_URL=https://api.aladhan.com/v1
TIMEZONE=Asia/Jakarta`;
    
    fs.writeFileSync(envFile, envContent);
    console.log('✅ File .env dibuat');
  }
  
  console.log('\n🎉 Setup selesai!');
  console.log('\n🚀 Untuk menjalankan server:');
  console.log('   cd backend');
  console.log('   npm run dev');
  console.log('\n🌐 Akses aplikasi di:');
  console.log('   - Halaman Utama: http://localhost:3000/');
  console.log('   - Admin Panel: http://localhost:3000/admin');
  console.log('\n📊 Untuk database:');
  console.log('   Buka HeidiSQL dan import file database.sql');
});
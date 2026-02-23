@echo off
echo ============================================
echo    SETUP SISTEM MASJID DI LARAGON
echo ============================================
echo.

REM Cek apakah Node.js terinstall
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo ❌ Node.js tidak ditemukan!
    echo Silakan install Node.js dari https://nodejs.org/
    pause
    exit /b 1
)

echo ✅ Node.js terdeteksi

REM Cek apakah Laragon berjalan
tasklist | findstr "laragon" >nul
if %errorlevel% neq 0 (
    echo ⚠️ Laragon tidak berjalan
    echo Jalankan Laragon terlebih dahulu
    pause
    exit /b 1
)

echo ✅ Laragon berjalan

REM Buat struktur folder
echo.
echo 📁 Membuat struktur folder...
mkdir "C:\laragon\www\masjid-system" 2>nul
mkdir "C:\laragon\www\masjid-system\backend" 2>nul
mkdir "C:\laragon\www\masjid-system\frontend" 2>nul
mkdir "C:\laragon\www\masjid-system\frontend\uploads" 2>nul

echo ✅ Struktur folder dibuat

REM Copy file ke Laragon
echo.
echo 📋 Menyalin file ke Laragon...
xcopy "%~dp0*.*" "C:\laragon\www\masjid-system\" /E /I /Y
xcopy "%~dp0backend\*.*" "C:\laragon\www\masjid-system\backend\" /E /I /Y
xcopy "%~dp0frontend\*.*" "C:\laragon\www\masjid-system\frontend\" /E /I /Y

echo ✅ File berhasil disalin

REM Install dependencies
echo.
echo 📦 Menginstall dependencies...
cd /d "C:\laragon\www\masjid-system\backend"
call npm install

echo ✅ Dependencies terinstall

REM Import database ke MySQL
echo.
echo 🗄️  Mengimport database...
mysql -u root < "C:\laragon\www\masjid-system\database.sql"

echo ✅ Database diimport

REM Buat file .env
echo.
echo ⚙️  Membuat file konfigurasi...
(
echo # Database Configuration
echo DB_HOST=localhost
echo DB_USER=root
echo DB_PASSWORD=
echo DB_NAME=masjid_db
echo DB_PORT=3306
echo.
echo # Server Configuration
echo PORT=3000
echo NODE_ENV=development
) > "C:\laragon\www\masjid-system\backend\.env"

echo ✅ File .env dibuat

echo.
echo ============================================
echo    SETUP SELESAI!
echo ============================================
echo.
echo 🚀 Untuk menjalankan server:
echo    1. Buka terminal di folder: C:\laragon\www\masjid-system\backend
echo    2. Jalankan: npm run dev
echo.
echo 🌐 Akses aplikasi di:
echo    - Halaman Utama: http://localhost:3000/
echo    - Admin Panel: http://localhost:3000/admin
echo.
echo 📊 Database: Buka HeidiSQL -> Connect ke MySQL
echo.
pause
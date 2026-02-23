# import-database.ps1
Write-Host "🔄 Mengimport database ke MySQL..." -ForegroundColor Yellow

# Konfigurasi database
$sqlFile = "database.sql"
$mysqlPath = "C:\laragon\bin\mysql\mysql-8.0.30-winx64\bin\mysql.exe"

# Cek apakah file SQL ada
if (-not (Test-Path $sqlFile)) {
    Write-Host "❌ File $sqlFile tidak ditemukan!" -ForegroundColor Red
    exit 1
}

# Cek apakah MySQL ada di Laragon
if (-not (Test-Path $mysqlPath)) {
    # Coba cari MySQL di Laragon
    $laragonPath = "C:\laragon\bin\mysql"
    $mysqlFolders = Get-ChildItem -Path $laragonPath -Directory | Where-Object {$_.Name -like "mysql*"}
    
    if ($mysqlFolders.Count -eq 0) {
        Write-Host "❌ MySQL tidak ditemukan di Laragon!" -ForegroundColor Red
        exit 1
    }
    
    $mysqlPath = Join-Path $mysqlFolders[0].FullName "bin\mysql.exe"
}

# Import database
Write-Host "📋 Mengimport file: $sqlFile" -ForegroundColor Cyan

# Gunakan Get-Content dan pipe ke mysql
Get-Content $sqlFile | & $mysqlPath -u root

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Database berhasil diimport!" -ForegroundColor Green
} else {
    Write-Host "❌ Gagal mengimport database" -ForegroundColor Red
}
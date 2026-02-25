#!/usr/bin/env powershell

# Authentication System Setup Verification
# Run this after setup to verify everything works

Write-Host "`n🔐 Authentication System Verification" -ForegroundColor Cyan
Write-Host "======================================`n" -ForegroundColor Cyan

# Check 1: Verify all files exist
Write-Host "1️⃣  Checking required files..." -ForegroundColor Yellow

$files = @(
    "config/session.js",
    "config/database.js",
    "middleware/auth.js",
    "controllers/authController.js",
    "routes/auth.js",
    "setup-auth.js",
    "public/login.html",
    "public/auth-helper.js"
)

$allExist = $true
foreach ($file in $files) {
    if (Test-Path $file) {
        Write-Host "   ✅ $file" -ForegroundColor Green
    } else {
        Write-Host "   ❌ $file (MISSING)" -ForegroundColor Red
        $allExist = $false
    }
}

if ($allExist) {
    Write-Host "`n✅ All files present!`n" -ForegroundColor Green
} else {
    Write-Host "`n❌ Some files are missing!`n" -ForegroundColor Red
    exit 1
}

# Check 2: Package.json scripts
Write-Host "2️⃣  Checking npm scripts..." -ForegroundColor Yellow
$packageJson = Get-Content package.json | ConvertFrom-Json
if ($packageJson.scripts.PSObject.Properties['setup-auth']) {
    Write-Host "   ✅ setup-auth script found" -ForegroundColor Green
} else {
    Write-Host "   ❌ setup-auth script not found" -ForegroundColor Red
}

# Check 3: ExpressJS session installed
Write-Host "`n3️⃣  Checking dependencies..." -ForegroundColor Yellow
if (Test-Path "node_modules/express-session") {
    Write-Host "   ✅ express-session installed" -ForegroundColor Green
} else {
    Write-Host "   ⚠️  express-session not found (install with: npm install)" -ForegroundColor Yellow
}

if (Test-Path "node_modules/bcrypt") {
    Write-Host "   ✅ bcrypt installed" -ForegroundColor Green
} else {
    Write-Host "   ⚠️  bcrypt not found (install with: npm install)" -ForegroundColor Yellow
}

Write-Host "`n✅ Setup verification complete!`n" -ForegroundColor Green
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "  1. npm run setup-auth    # Create users table and default admin" -ForegroundColor White
Write-Host "  2. npm start             # Start the server" -ForegroundColor White
Write-Host "  3. Open http://localhost:3000 in browser" -ForegroundColor White
Write-Host "`n"

# 🍡 DietPi Setup Guide

Complete guide to run this Masjid Admin System on DietPi (Lightweight Linux for Raspberry Pi & SBC)

## Prerequisites

- DietPi installed on Raspberry Pi or SBC
- SSH access to your DietPi device
- Minimum 2GB RAM (4GB recommended)
- ~1GB free disk space

---

## Phase 1: System Preparation (5-10 minutes)

### Step 1.1: Update System
```bash
sudo apt update
sudo apt upgrade -y
```

### Step 1.2: Install Essential Build Tools
```bash
sudo apt install -y \
  build-essential \
  python3-dev \
  git \
  curl \
  wget \
  unzip
```

### Step 1.3: Install Node.js (Latest LTS)
```bash
# Using NodeSource repository (recommended)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Verify installation
node --version
npm --version
```

**Alternative**: If NodeSource doesn't work, use Node Version Manager:
```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
source ~/.bashrc
nvm install 20
nvm use 20
```

---

## Phase 2: Database Setup (10-15 minutes)

### Option A: MariaDB (Recommended for DietPi)

**Why**: Lightweight, optimized for SBC, compatible with MySQL

```bash
# Install MariaDB server
sudo apt install -y mariadb-server mariadb-client

# Start and enable on boot
sudo systemctl start mariadb
sudo systemctl enable mariadb

# Secure installation (optional but recommended)
sudo mysql_secure_installation
```

### Option B: MySQL Community Server

```bash
sudo apt install -y mysql-server mysql-client

sudo systemctl start mysql
sudo systemctl enable mysql

sudo mysql_secure_installation
```

### Create Database User and Database

```bash
# Login to MySQL/MariaDB
sudo mysql -u root

# Create database
CREATE DATABASE masjid_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

# Create dedicated user (more secure than root)
CREATE USER 'masjid_user'@'localhost' IDENTIFIED BY 'your_secure_password';

# Grant permissions
GRANT ALL PRIVILEGES ON masjid_db.* TO 'masjid_user'@'localhost';
FLUSH PRIVILEGES;

# Exit MySQL
EXIT;
```

### Import Database Schema

```bash
# Navigate to backend folder
cd ~/masjid-app/backend

# Import database
sudo mysql -u masjid_user -p masjid_db < database.sql
# When prompted, enter the password you set above
```

**Verify:**
```bash
sudo mysql -u masjid_user -p -e "USE masjid_db; SHOW TABLES;"
```

---

## Phase 3: App Installation (10 minutes)

### Step 3.1: Clone/Download App

```bash
# Option 1: If already on DietPi
cd ~
# Copy your app files here (via SCP or USB)

# Option 2: If using Git
git clone <your-repo-url> masjid-app
cd masjid-app/backend
```

### Step 3.2: Install Node Dependencies

```bash
cd ~/masjid-app/backend
npm install
```

**Expected output:**
```
added XX packages in XXs
```

---

## Phase 4: Environment Configuration

### Step 4.1: Create .env File

```bash
nano .env
```

Copy and paste this configuration:

```env
# Database Configuration
DB_HOST=localhost
DB_USER=masjid_user
DB_PASSWORD=your_secure_password
DB_NAME=masjid_db

# Server Configuration
PORT=3000
NODE_ENV=production

# Optional: For remote database (if DB on different host)
# DB_HOST=192.168.1.100
```

**Save**: Press `Ctrl+X`, then `Y`, then `Enter`

### Step 4.2: Verify Configuration

```bash
node -e "require('dotenv').config(); console.log(process.env.DB_HOST);"
```

Should output: `localhost`

---

## Phase 5: Database Initialization

### First Run Setup

```bash
cd ~/masjid-app/backend

# Initialize database tables and create default admin
npm run setup-auth
```

**Output should show:**
```
✅ Default admin user created

📝 Default credentials:
   Username: admin
   Password: admin123
   Email: admin@masjid.local
```

---

## Phase 6: Test Run (Verify Everything Works)

```bash
cd ~/masjid-app/backend
npm start
```

**Expected output:**
```
✅ Database connected successfully
🚀 Masjid Admin System running on http://localhost:3000
WebSocket server running on port 3000
```

### Test from Another Machine

```bash
# Find DietPi IP
hostname -I

# Open browser and visit
http://<dietpi-ip>:3000/admin
```

**Login with:**
- Username: `admin`
- Password: `admin123`

---

## Phase 7: Autostart Setup (SystemD Service)

Create a service file so app auto-starts on boot:

### Step 7.1: Create Service File

```bash
sudo nano /etc/systemd/system/masjid-app.service
```

Paste this content:

```ini
[Unit]
Description=Masjid Admin System
After=network.target mariadb.service

[Service]
Type=simple
User=dietpi
WorkingDirectory=/home/dietpi/masjid-app/backend
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

# Environment variables
Environment="NODE_ENV=production"
Environment="PORT=3000"

# Resource limits (prevent memory exhaustion on SBC)
MemoryLimit=512M
CPUQuota=80%

[Install]
WantedBy=multi-user.target
```

### Step 7.2: Enable and Start Service

```bash
sudo systemctl daemon-reload
sudo systemctl enable masjid-app.service
sudo systemctl start masjid-app.service

# Check status
sudo systemctl status masjid-app.service

# View logs (Ctrl+C to exit)
sudo journalctl -u masjid-app.service -f
```

---

## Phase 8: Reverse Proxy Setup (Optional but Recommended)

Run app on port 3000, access via port 80 (HTTP)

### Install Nginx

```bash
sudo apt install -y nginx

sudo systemctl start nginx
sudo systemctl enable nginx
```

### Configure Nginx as Reverse Proxy

```bash
sudo nano /etc/nginx/sites-available/masjid
```

Paste this:

```nginx
server {
    listen 80 default_server;
    listen [::]:80 default_server;

    server_name _;

    # For large file uploads (adjust if needed)
    client_max_body_size 100M;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # WebSocket support
        proxy_read_timeout 86400;
    }
}
```

Enable site:

```bash
sudo ln -s /etc/nginx/sites-available/masjid /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl restart nginx
```

Now access via: `http://<dietpi-ip>` (without port 3000)

---

## Troubleshooting

### Issue: "Database connection failed"

```bash
# Check MariaDB status
sudo systemctl status mariadb

# Restart MariaDB
sudo systemctl restart mariadb

# Verify MySQL is accepting connections
sudo mysql -u masjid_user -p

# Check if port 3306 is open
sudo netstat -tuln | grep 3306
```

### Issue: "npm install" fails on bcrypt

```bash
# Install Python (required for bcrypt compilation)
sudo apt install -y python3 make g++

# Retry npm install
npm install
```

### Issue: "Cannot find module" after git pull

```bash
cd ~/masjid-app/backend
rm -rf node_modules package-lock.json
npm install
npm run setup-auth
```

### Issue: App crashes on startup

```bash
# Check logs
sudo journalctl -u masjid-app.service -n 50

# Test database connection
node -e "const db = require('./config/database'); console.log('DB OK');"

# Run in debug mode (temporary)
npm start
```

### Issue: Upload feature not working

```bash
# Ensure uploads folder exists and has permissions
mkdir -p ~/masjid-app/backend/public/uploads
chmod -R 755 ~/masjid-app/backend/public/uploads

# Restart service
sudo systemctl restart masjid-app.service
```

---

## Maintenance & Updates

### Check App Status

```bash
sudo systemctl status masjid-app.service
```

### View Real-time Logs

```bash
sudo journalctl -u masjid-app.service -f
```

### Update Node Packages

```bash
cd ~/masjid-app/backend
npm update
sudo systemctl restart masjid-app.service
```

### Backup Database

```bash
mysqldump -u masjid_user -p masjid_db > ~/masjid_backup_$(date +%Y%m%d).sql
```

### Restore Database

```bash
sudo mysql -u masjid_user -p masjid_db < ~/masjid_backup_YYYYMMDD.sql
```

---

## Performance Optimization for SBC

### Reduce Node Memory Usage

Add to `.env`:
```env
NODE_OPTIONS=--max-old-space-size=256
```

### Enable Nginx Caching

Add to nginx config `/etc/nginx/sites-available/masjid`:
```nginx
# Cache static files for 1 day
location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
    expires 1d;
    add_header Cache-Control "public, immutable";
}
```

### Limit Process Resources

Edit `/etc/systemd/system/masjid-app.service`:
```ini
MemoryLimit=256M
CPUQuota=50%
```

---

## Accessing from Outside Your Network (Advanced)

### Option 1: Local Network Only
Just use IP address: `http://192.168.x.x`

### Option 2: Cloudflare Tunnel (Free, No Port Forwarding)

```bash
curl -L --output cloudflared.deb https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-arm.deb
sudo dpkg -i cloudflared.deb
sudo cloudflared tunnel login
sudo cloudflared tunnel create masjid
sudo cloudflared tunnel route dns masjid yourdomain.com
```

---

## Summary: What You Now Have

✅ Node.js running on DietPi  
✅ MariaDB database configured  
✅ Masjid Admin System installed  
✅ App running as auto-starting service  
✅ Nginx reverse proxy (optional)  
✅ Full authentication system  
✅ WebSocket real-time updates  
✅ File upload capability

---

## Quick Command Reference

```bash
# Status
sudo systemctl status masjid-app.service

# Restart app
sudo systemctl restart masjid-app.service

# Restart database
sudo systemctl restart mariadb

# View logs
sudo journalctl -u masjid-app.service -f

# Test connection
curl http://localhost:3000

# Find IP
hostname -I

# Stop app
sudo systemctl stop masjid-app.service
```

---

## Need Help?

1. Check logs: `sudo journalctl -u masjid-app.service -n 100`
2. Verify DB connection: `sudo mysql -u masjid_user -p masjid_db -e "SELECT 1"`
3. Test app directly: `npm start` and check console output

**Good luck! 🚀**

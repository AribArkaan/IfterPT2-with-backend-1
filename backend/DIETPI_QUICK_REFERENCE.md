# DietPi Quick Reference

## Fastest Setup (Automated) - 5 minutes

```bash
# Download setup script
sudo wget https://raw.githubusercontent.com/your-repo/backend/setup-dietpi.sh
chmod +x setup-dietpi.sh

# Run automated setup
sudo ./setup-dietpi.sh

# Follow prompts and wait for completion
```

## Manual Setup - 15 minutes

```bash
# 1. Update system
sudo apt update && sudo apt upgrade -y

# 2. Install Node.js
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# 3. Install MariaDB
sudo apt install -y mariadb-server mariadb-client
sudo systemctl start mariadb
sudo systemctl enable mariadb

# 4. Create database
sudo mysql -e "CREATE DATABASE masjid_db CHARACTER SET utf8mb4;"
sudo mysql -e "CREATE USER 'masjid_user'@'localhost' IDENTIFIED BY 'password';"
sudo mysql -e "GRANT ALL ON masjid_db.* TO 'masjid_user'@'localhost';"
sudo mysql -e "FLUSH PRIVILEGES;"

# 5. Setup app
npm install
cp .env.example .env
# Edit .env with your credentials
nano .env

# 6. Initialize
npm run setup-auth

# 7. Test
npm start
```

## Autostart Service

```bash
# Copy service file
sudo cp masjid-app.service /etc/systemd/system/

# Enable and start
sudo systemctl daemon-reload
sudo systemctl enable masjid-app.service
sudo systemctl start masjid-app.service

# Check status
sudo systemctl status masjid-app.service
```

## Access the App

```bash
# Find DietPi IP
hostname -I

# In browser: http://<ip>:3000
# Default: admin / admin123
```

## Troubleshooting

```bash
# Check logs
sudo journalctl -u masjid-app.service -f

# Restart
sudo systemctl restart masjid-app.service

# Database issues
sudo systemctl restart mariadb
sudo mysql -u masjid_user -p masjid_db

# Check ports
sudo netstat -tuln | grep 3000
```

## Port 80 Access (Optional)

```bash
sudo apt install -y nginx

# Configure Nginx as proxy
sudo nano /etc/nginx/sites-available/masjid

# Paste the nginx config from DIETPI_SETUP.md

sudo ln -s /etc/nginx/sites-available/masjid /etc/nginx/sites-enabled/
sudo systemctl restart nginx

# Now access: http://<ip> (without port)
```

---

For detailed guide, see: **DIETPI_SETUP.md**

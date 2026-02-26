#!/bin/bash
# DietPi Automated Setup Script
# Run this as: chmod +x setup-dietpi.sh && ./setup-dietpi.sh

set -e  # Exit on any error

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}🍡 Masjid App - DietPi Automated Setup${NC}"
echo "=========================================="

# Check if running as sudo
if [[ $EUID -ne 0 ]]; then
   echo -e "${RED}❌ This script must be run as sudo${NC}"
   exit 1
fi

# Step 1: Update System
echo -e "\n${YELLOW}[1/7] Updating system packages...${NC}"
apt update
apt upgrade -y

# Step 2: Install Node.js
echo -e "\n${YELLOW}[2/7] Installing Node.js...${NC}"
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs git curl wget build-essential python3-dev

# Verify Node.js
node_version=$(node --version)
echo -e "${GREEN}✅ Node.js ${node_version} installed${NC}"

# Step 3: Install MariaDB
echo -e "\n${YELLOW}[3/7] Installing MariaDB...${NC}"
apt install -y mariadb-server mariadb-client
systemctl start mariadb
systemctl enable mariadb

echo -e "${GREEN}✅ MariaDB installed and started${NC}"

# Step 4: Create Database
echo -e "\n${YELLOW}[4/7] Setting up database...${NC}"

read -p "Enter database password for masjid_user: " db_password

mysql -e "CREATE DATABASE IF NOT EXISTS masjid_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
mysql -e "CREATE USER IF NOT EXISTS 'masjid_user'@'localhost' IDENTIFIED BY '$db_password';"
mysql -e "GRANT ALL PRIVILEGES ON masjid_db.* TO 'masjid_user'@'localhost';"
mysql -e "FLUSH PRIVILEGES;"

echo -e "${GREEN}✅ Database and user created${NC}"

# Step 5: Install App Dependencies
echo -e "\n${YELLOW}[5/7] Installing app dependencies...${NC}"
npm install
echo -e "${GREEN}✅ Dependencies installed${NC}"

# Step 6: Setup Environment
echo -e "\n${YELLOW}[6/7] Setting up environment...${NC}"

if [ ! -f .env ]; then
    cp .env.example .env
    sed -i "s/your_secure_password_here/$db_password/" .env
    echo -e "${GREEN}✅ .env file created${NC}"
else
    echo -e "${YELLOW}⚠️  .env already exists, skipping...${NC}"
fi

# Step 7: Initialize Database & Auth
echo -e "\n${YELLOW}[7/7] Initializing database...${NC}"
npm run setup-auth

# Create SystemD Service
echo -e "\n${YELLOW}Creating SystemD service...${NC}"

cat > /etc/systemd/system/masjid-app.service << 'EOF'
[Unit]
Description=Masjid Admin System
After=network.target mariadb.service

[Service]
Type=simple
User=root
WorkingDirectory=/home/dietpi/masjid-app/backend
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
Environment="NODE_ENV=production"
Environment="PORT=3000"
MemoryLimit=512M

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable masjid-app.service

echo -e "${GREEN}✅ SystemD service created${NC}"

# Done!
echo -e "\n${GREEN}=========================================="
echo "✅ Setup Complete!"
echo "=========================================="
echo -e "\n${YELLOW}Next steps:${NC}"
echo "1. Start service: sudo systemctl start masjid-app.service"
echo "2. Check status: sudo systemctl status masjid-app.service"
echo "3. View logs: sudo journalctl -u masjid-app.service -f"
echo ""
echo -e "${YELLOW}Default credentials:${NC}"
echo "Username: admin"
echo "Password: admin123"
echo ""
echo -e "${YELLOW}Find your IP:${NC}"
echo "hostname -I"
echo ""
echo -e "${GREEN}Then visit: http://<your-ip>:3000/admin${NC}\n"

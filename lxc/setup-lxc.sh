#!/usr/bin/env bash
# ====================================================================
# Sous Chef AI (Mpishi Cooking) - LXC Container Provisioning Script
# Ubuntu 24.04 / Debian 12
# ====================================================================

set -e

echo "=== [1/6] Updating package repositories ==="
apt update && apt upgrade -y
apt install -y curl wget git nginx ufw ca-certificates gnupg

echo "=== [2/6] Installing Node.js 22 LTS ==="
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
    apt install -y nodejs
fi
node -v
npm -v

echo "=== [3/6] Setting up Persistent Storage Container Directories ==="
mkdir -p /var/lib/mpishi/data/backups
mkdir -p /var/lib/mpishi/data/images
mkdir -p /var/www/mpishi
chmod -R 755 /var/lib/mpishi

echo "=== [4/6] Installing and Configuring Tailscale ==="
if ! command -v tailscale &> /dev/null; then
    curl -fsSL https://tailscale.com/install.sh | sh
    echo "Tailscale installed! To authenticate, run: tailscale up --ssh"
fi

echo "=== [5/6] Configuring Nginx Reverse Proxy ==="
if [ -f /var/www/mpishi/nginx/mpishi.conf ]; then
    cp /var/www/mpishi/nginx/mpishi.conf /etc/nginx/sites-available/mpishi.conf
    ln -sf /etc/nginx/sites-available/mpishi.conf /etc/nginx/sites-enabled/
    rm -f /etc/nginx/sites-enabled/default
    nginx -t
    systemctl restart nginx
fi

echo "=== [6/6] Installing Systemd Service ==="
if [ -f /var/www/mpishi/lxc/mpishi.service ]; then
    cp /var/www/mpishi/lxc/mpishi.service /etc/systemd/system/mpishi.service
    systemctl daemon-reload
    systemctl enable mpishi.service
fi

echo "================================================================"
echo " Setup complete!"
echo " Next steps:"
echo " 1. Put code in /var/www/mpishi"
echo " 2. Run 'npm install && npm run build' in /var/www/mpishi"
echo " 3. Run 'tailscale up' to join your Tailnet"
echo " 4. Start service with 'systemctl start mpishi.service'"
echo "================================================================"

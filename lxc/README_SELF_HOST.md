# Self-Hosting Sous Chef AI (Mpishi Cooking) in LXC with Nginx & Tailscale

This guide walks you through migrating from client-side demo storage to a **local self-hosted LXC container** with persistent volume storage, 2-user authentication, Nginx reverse proxying, and Tailscale mesh networking.

---

## Architecture Overview

```
                      [Tailscale Mesh Network]
             iPhone / iPad / Laptop (Tailnet devices)
                               │
                               ▼
               ┌────────────────────────────────┐
               │         LXC Container          │
               │                                │
               │  [Tailscale Daemon (MagicDNS)] │
               │               │                │
               │               ▼                │
               │      [Nginx Reverse Proxy]     │
               │        (Port 80 / 443)         │
               │               │                │
               │               ▼                │
               │    [Node.js Express Server]    │
               │          (Port 3000)           │
               │               │                │
               │               ▼                │
               │    [Storage Container Volume]  │
               │  /var/lib/mpishi/data/db.json  │
               │  /var/lib/mpishi/data/images/  │
               │  /var/lib/mpishi/data/backups/ │
               └────────────────────────────────┘
```

---

## 1. LXC Container Preparation (Proxmox VE / LXD)

### For Proxmox VE:
1. Create a container (Debian 12 or Ubuntu 24.04).
   - **Cores:** 1–2
   - **RAM:** 1024MB – 2048MB
   - **Disk:** 16GB+
2. **Crucial for Tailscale in LXC**:
   Tailscale requires TUN device access. On the Proxmox host, edit `/etc/pve/lxc/<CTID>.conf`:
   ```conf
   # Add at bottom of /etc/pve/lxc/<CTID>.conf:
   lxc.cgroup2.devices.allow: c 10:200 rwm
   lxc.mount.entry: /dev/net/tun dev/net/tun none bind,create=file
   ```
3. Start the container and open its console.

---

## 2. Container Setup & App Deployment

Run the bootstrap script or commands manually inside the LXC container:

```bash
# 1. Update and install prerequisites
apt update && apt upgrade -y
apt install -y curl git nginx

# 2. Install Node.js 22 LTS
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt install -y nodejs

# 3. Create persistent storage directory
mkdir -p /var/lib/mpishi/data/backups
mkdir -p /var/lib/mpishi/data/images
mkdir -p /var/www/mpishi

# 4. Clone or copy your application code to /var/www/mpishi
cd /var/www/mpishi
npm install
npm run build
```

---

## 3. Persistent Storage Container

The application server manages all recipes, meal plans, inventory, and users centrally in:
- **Database file:** `/var/lib/mpishi/data/db.json`
- **Recipe photos:** `/var/lib/mpishi/data/images/`
- **Snapshots:** `/var/lib/mpishi/data/backups/`

### Automated Daily Snapshot (Optional Cron):
Add to container crontab (`crontab -e`):
```bash
0 3 * * * cp /var/lib/mpishi/data/db.json /var/lib/mpishi/data/backups/db_nightly_$(date +\%Y\%m\%d).json
```

---

## 4. 2-User Access Control

The database comes pre-configured with two user profiles:
- **Head Chef (Admin):** Username `chef1`, Default password: `Mpishi4me!`
- **Sous Chef (User):** Username `chef2`, Default password: `Cooking123!`

Both users can be renamed, re-colored, and have their passwords changed directly inside the in-app **Self-Host & Admin Console** under the **2-User Management** tab.

---

## 5. Nginx Reverse Proxy Setup

Copy the included `nginx/mpishi.conf` to Nginx sites:

```bash
cp /var/www/mpishi/nginx/mpishi.conf /etc/nginx/sites-available/mpishi.conf
ln -s /etc/nginx/sites-available/mpishi.conf /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl restart nginx
```

---

## 6. Tailscale Mesh VPN Integration

Connect your LXC container to your Tailscale network:

```bash
# 1. Install Tailscale
curl -fsSL https://tailscale.com/install.sh | sh

# 2. Authenticate
tailscale up --ssh

# 3. Check Tailscale IP / MagicDNS name
tailscale status
tailscale ip -4
```

### Free Let's Encrypt HTTPS via Tailscale Cert:
Tailscale generates free HTTPS TLS certificates for your machine:
```bash
mkdir -p /var/lib/tailscale/certs
tailscale cert --cert-file=/var/lib/tailscale/certs/mpishi.tailnet.ts.net.crt \
               --key-file=/var/lib/tailscale/certs/mpishi.tailnet.ts.net.key \
               mpishi.tailnet.ts.net
```

Now, any device on your Tailnet (iPhone, Android, iPad, MacBook, PC) can open:
`http://mpishi.tailnet.ts.net` or `https://mpishi.tailnet.ts.net` with **zero open router ports** and enterprise-grade WireGuard encryption!

---

## 7. Autostart with Systemd

Enable the background service so Sous Chef restarts on container boot:

```bash
cp /var/www/mpishi/lxc/mpishi.service /etc/systemd/system/mpishi.service
systemctl daemon-reload
systemctl enable --now mpishi.service

# Check status:
systemctl status mpishi.service
```

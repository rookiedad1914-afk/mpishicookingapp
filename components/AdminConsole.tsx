import React, { useState, useEffect } from 'react';
import { 
  Server, Users, Database, Shield, HardDrive, Download, RefreshCw, 
  CheckCircle2, AlertCircle, Copy, Check, Terminal, ExternalLink, 
  Key, Edit2, Save, X, Lock, Cpu, Globe, ArrowRight
} from 'lucide-react';
import { UserProfile, StorageStats, ServerBackupFile, Recipe } from '../types';
import * as storage from '../services/storageService';

interface AdminConsoleProps {
  onClose: () => void;
  currentUser: UserProfile | null;
  onUserSwitched: (user: UserProfile) => void;
  recipes: Recipe[];
  onDataRefreshed: () => void;
}

type AdminTab = 'USERS' | 'STORAGE' | 'LXC_NGINX' | 'TAILSCALE';

const AdminConsole: React.FC<AdminConsoleProps> = ({
  onClose,
  currentUser,
  onUserSwitched,
  recipes,
  onDataRefreshed
}) => {
  const [activeTab, setActiveTab] = useState<AdminTab>('USERS');
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [storageStats, setStorageStats] = useState<StorageStats | null>(null);
  const [backups, setBackups] = useState<ServerBackupFile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // User Edit State
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editUsername, setEditUsername] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [editColor, setEditColor] = useState('#ea580c');

  // Copy status
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Tailscale Hostname state
  const [tailscaleHost, setTailscaleHost] = useState(
    storageStats?.tailscaleInfo?.hostname || 'mpishi-kitchen.tailnet.ts.net'
  );

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [userList, stats, backupList] = await Promise.all([
        storage.fetchUsers(),
        storage.getStorageStats(),
        storage.getServerBackups()
      ]);
      setUsers(userList);
      setStorageStats(stats);
      setBackups(backupList);
      if (stats?.tailscaleInfo?.hostname) {
        setTailscaleHost(stats.tailscaleInfo.hostname);
      }
    } catch (e) {
      console.error('Error loading admin data:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2500);
  };

  const handleStartEditUser = (user: UserProfile) => {
    setEditingUserId(user.id);
    setEditName(user.name);
    setEditUsername(user.username);
    setEditPassword('');
    setEditColor(user.avatarColor || '#ea580c');
  };

  const handleSaveUser = async (userId: string) => {
    try {
      const updated = await storage.updateUserProfile(userId, {
        name: editName,
        username: editUsername,
        newPassword: editPassword || undefined,
        avatarColor: editColor
      });
      if (updated) {
        setUsers(prev => prev.map(u => u.id === userId ? { ...u, ...updated } : u));
        if (currentUser?.id === userId) {
          onUserSwitched(updated);
        }
        setEditingUserId(null);
        setStatusMessage({ text: `Updated user "${editName}" successfully!`, type: 'success' });
        setTimeout(() => setStatusMessage(null), 3000);
      }
    } catch (err: any) {
      setStatusMessage({ text: 'Failed to update user', type: 'error' });
    }
  };

  const handleCreateSnapshot = async () => {
    try {
      const filename = await storage.createServerSnapshot();
      if (filename) {
        setStatusMessage({ text: `Created snapshot: ${filename}`, type: 'success' });
        loadData();
      } else {
        setStatusMessage({ text: 'Failed to create snapshot', type: 'error' });
      }
    } catch (err) {
      setStatusMessage({ text: 'Snapshot creation failed', type: 'error' });
    }
  };

  const handleRestoreSnapshot = async (filename: string) => {
    if (!window.confirm(`Are you sure you want to restore "${filename}"? Current data will be replaced.`)) {
      return;
    }
    try {
      const ok = await storage.restoreServerSnapshot(filename);
      if (ok) {
        setStatusMessage({ text: `Successfully restored ${filename}!`, type: 'success' });
        await storage.syncWithServer();
        onDataRefreshed();
        loadData();
      } else {
        setStatusMessage({ text: 'Restore failed on server', type: 'error' });
      }
    } catch (err) {
      setStatusMessage({ text: 'Restore failed', type: 'error' });
    }
  };

  // Nginx Configuration Snippet
  const nginxConfig = `
# ================================================================
# /etc/nginx/sites-available/mpishi.conf
# Nginx Reverse Proxy for Sous Chef AI in LXC with Tailscale HTTPS
# ================================================================

server {
    listen 80;
    server_name ${tailscaleHost} localhost;
    # Redirect HTTP to Tailscale HTTPS if SSL is enabled
    # return 301 https://$host$request_uri;

    client_max_body_size 50M;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Cache static recipe images directly
    location /api/images/ {
        proxy_pass http://127.0.0.1:3000/api/images/;
        proxy_cache_valid 200 30d;
        expires 30d;
        add_header Cache-Control "public, no-transform";
    }
}

# Optional: Direct Tailscale HTTPS block using "tailscale cert"
# server {
#     listen 443 ssl http2;
#     server_name ${tailscaleHost};
#
#     ssl_certificate /var/lib/tailscale/certs/${tailscaleHost}.crt;
#     ssl_certificate_key /var/lib/tailscale/certs/${tailscaleHost}.key;
#     ssl_protocols TLSv1.2 TLSv1.3;
#
#     location / {
#         proxy_pass http://127.0.0.1:3000;
#         proxy_http_version 1.1;
#         proxy_set_header Upgrade $http_upgrade;
#         proxy_set_header Connection 'upgrade';
#         proxy_set_header Host $host;
#     }
# }
`.trim();

  // Systemd Service Snippet
  const systemdService = `
# ================================================================
# /etc/systemd/system/mpishi.service
# Systemd unit file for autostarting Sous Chef in LXC Container
# ================================================================
[Unit]
Description=Sous Chef AI Recipe Server (Mpishi Cooking)
After=network.target tailscaled.service

[Service]
Type=simple
User=root
WorkingDirectory=/var/www/mpishi
Environment=NODE_ENV=production
Environment=PORT=3000
Environment=DATA_DIR=/var/lib/mpishi/data
# Set your Gemini API key here so recipes can be parsed and modified:
Environment=GEMINI_API_KEY=YOUR_GEMINI_API_KEY
Environment=TAILSCALE_HOSTNAME=${tailscaleHost}
ExecStart=/usr/bin/node server.ts
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
`.trim();

  // LXC Setup Script Snippet
  const lxcSetupScript = `
# ================================================================
# Proxmox / Ubuntu LXC Container Provisioning Guide
# ================================================================

# 1. In Proxmox VE (Host shell):
# Create a Debian 12 or Ubuntu 24.04 container (e.g. CT ID 120)
# Ensure TUN is enabled in /etc/pve/lxc/120.conf:
# lxc.cgroup2.devices.allow: c 10:200 rwm
# lxc.mount.entry: /dev/net/tun dev/net/tun none bind,create=file

# 2. Inside the LXC Container:
apt update && apt install -y curl git nginx nodejs npm

# Install modern Node.js (v22+)
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt install -y nodejs

# 3. Create persistent storage directory
mkdir -p /var/lib/mpishi/data/backups
mkdir -p /var/lib/mpishi/data/images
mkdir -p /var/www/mpishi

# 4. Deploy app files to /var/www/mpishi
cd /var/www/mpishi
npm install
npm run build

# 5. Enable systemd service & Nginx
systemctl enable --now mpishi.service
systemctl restart nginx
`.trim();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col h-[90vh] max-h-[820px] border border-gray-200 animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-stone-900 via-stone-800 to-chef-950 text-white flex justify-between items-center shrink-0">
          <div className="flex items-center gap-3">
            <div className="bg-chef-500/20 p-2.5 rounded-xl border border-chef-500/40 text-chef-400">
              <Server className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-lg sm:text-xl text-white">Self-Host & Admin Console</h3>
                <span className="bg-chef-500/30 text-chef-300 text-xs px-2.5 py-0.5 rounded-full font-mono border border-chef-500/40">
                  LXC • Nginx • Tailscale
                </span>
              </div>
              <p className="text-xs text-stone-300">
                Persistent Container Storage • 2-User Access Control • Mesh VPN Networking
              </p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="p-2 text-stone-400 hover:text-white hover:bg-stone-700/60 rounded-xl transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="bg-stone-100 border-b border-stone-200 px-4 flex gap-2 overflow-x-auto no-scrollbar shrink-0">
          <button
            onClick={() => setActiveTab('USERS')}
            className={`py-3 px-4 font-semibold text-sm flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'USERS'
                ? 'border-chef-600 text-chef-700 bg-white shadow-sm rounded-t-lg'
                : 'border-transparent text-stone-600 hover:text-stone-900'
            }`}
          >
            <Users className="w-4 h-4" />
            2-User Management
          </button>
          <button
            onClick={() => setActiveTab('STORAGE')}
            className={`py-3 px-4 font-semibold text-sm flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'STORAGE'
                ? 'border-chef-600 text-chef-700 bg-white shadow-sm rounded-t-lg'
                : 'border-transparent text-stone-600 hover:text-stone-900'
            }`}
          >
            <HardDrive className="w-4 h-4" />
            Storage Container & Backups
          </button>
          <button
            onClick={() => setActiveTab('LXC_NGINX')}
            className={`py-3 px-4 font-semibold text-sm flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'LXC_NGINX'
                ? 'border-chef-600 text-chef-700 bg-white shadow-sm rounded-t-lg'
                : 'border-transparent text-stone-600 hover:text-stone-900'
            }`}
          >
            <Terminal className="w-4 h-4" />
            LXC & Nginx Config
          </button>
          <button
            onClick={() => setActiveTab('TAILSCALE')}
            className={`py-3 px-4 font-semibold text-sm flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'TAILSCALE'
                ? 'border-chef-600 text-chef-700 bg-white shadow-sm rounded-t-lg'
                : 'border-transparent text-stone-600 hover:text-stone-900'
            }`}
          >
            <Globe className="w-4 h-4" />
            Tailscale Guide
          </button>
        </div>

        {/* Status Toast */}
        {statusMessage && (
          <div className={`px-4 py-2.5 text-xs font-semibold flex items-center gap-2 ${
            statusMessage.type === 'success' ? 'bg-emerald-50 text-emerald-800 border-b border-emerald-200' : 'bg-red-50 text-red-800 border-b border-red-200'
          }`}>
            {statusMessage.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" /> : <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />}
            <span>{statusMessage.text}</span>
          </div>
        )}

        {/* Tab Contents */}
        <div className="p-5 sm:p-6 flex-1 overflow-y-auto bg-stone-50/60">
          
          {/* TAB 1: 2-USER MANAGEMENT */}
          {activeTab === 'USERS' && (
            <div className="space-y-6">
              <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h4 className="font-bold text-stone-900 text-base flex items-center gap-2">
                    <Users className="w-5 h-5 text-chef-600" />
                    Kitchen Crew (2 Users Setup)
                  </h4>
                  <p className="text-xs text-stone-500 mt-0.5">
                    Configure your 2 household chefs. Both can add recipes, edit weekly meal plans, and check off shopping items.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-stone-500">Currently logged in as:</span>
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold text-chef-800 bg-chef-100 border border-chef-200">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: currentUser?.avatarColor || '#ea580c' }}></span>
                    {currentUser?.name || 'Chef'}
                  </span>
                </div>
              </div>

              {/* User Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {users.map(user => {
                  const isCurrent = currentUser?.id === user.id;
                  const isEditing = editingUserId === user.id;
                  const authorRecipeCount = recipes.filter(r => r.authorId === user.id).length;

                  return (
                    <div 
                      key={user.id}
                      className={`bg-white rounded-xl p-5 border transition-all shadow-sm ${
                        isCurrent ? 'border-chef-400 ring-2 ring-chef-100' : 'border-stone-200 hover:border-stone-300'
                      }`}
                    >
                      {!isEditing ? (
                        <div>
                          <div className="flex items-start justify-between mb-4">
                            <div className="flex items-center gap-3">
                              <div 
                                className="w-12 h-12 rounded-2xl flex items-center justify-center text-white font-black text-lg shadow-sm"
                                style={{ backgroundColor: user.avatarColor || '#ea580c' }}
                              >
                                {user.name.charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <h5 className="font-bold text-stone-900 text-base">{user.name}</h5>
                                  <span className={`text-[11px] font-bold px-2 py-0.5 rounded uppercase ${
                                    user.role === 'admin' 
                                      ? 'bg-amber-100 text-amber-800 border border-amber-200' 
                                      : 'bg-blue-100 text-blue-800 border border-blue-200'
                                  }`}>
                                    {user.role}
                                  </span>
                                </div>
                                <p className="text-xs font-mono text-stone-500">@{user.username}</p>
                              </div>
                            </div>

                            <button
                              onClick={() => handleStartEditUser(user)}
                              className="p-1.5 text-stone-400 hover:text-stone-700 hover:bg-stone-100 rounded-lg transition-colors"
                              title="Edit user details"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                          </div>

                          <div className="grid grid-cols-2 gap-2 text-xs bg-stone-50 p-3 rounded-lg border border-stone-100 mb-4">
                            <div>
                              <span className="text-stone-400 block font-medium">Recipes Authored</span>
                              <span className="font-bold text-stone-800 text-sm">{authorRecipeCount}</span>
                            </div>
                            <div>
                              <span className="text-stone-400 block font-medium">Access Tier</span>
                              <span className="font-bold text-stone-800 capitalize">{user.role}</span>
                            </div>
                          </div>

                          <div className="flex items-center justify-between pt-2">
                            {isCurrent ? (
                              <span className="text-xs font-bold text-emerald-700 flex items-center gap-1.5">
                                <CheckCircle2 className="w-4 h-4" /> Active Session
                              </span>
                            ) : (
                              <button
                                onClick={() => {
                                  storage.setActiveUser(user);
                                  onUserSwitched(user);
                                  setStatusMessage({ text: `Switched active chef to ${user.name}!`, type: 'success' });
                                }}
                                className="text-xs font-bold text-chef-600 hover:text-chef-700 hover:bg-chef-50 px-3 py-1.5 rounded-lg border border-chef-200 transition-colors flex items-center gap-1"
                              >
                                Switch to this Chef <ArrowRight className="w-3.5 h-3.5" />
                              </button>
                            )}

                            <span className="text-[11px] text-stone-400">
                              ID: {user.id}
                            </span>
                          </div>
                        </div>
                      ) : (
                        /* Edit User Form */
                        <div className="space-y-3 animate-in fade-in duration-150">
                          <div className="flex items-center justify-between pb-2 border-b border-stone-100">
                            <span className="font-bold text-stone-800 text-sm">Edit Chef Profile</span>
                            <button 
                              onClick={() => setEditingUserId(null)}
                              className="text-stone-400 hover:text-stone-600 p-1"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>

                          <div>
                            <label className="text-xs font-bold text-stone-600 block mb-1">Display Name</label>
                            <input 
                              type="text" 
                              value={editName}
                              onChange={e => setEditName(e.target.value)}
                              className="w-full text-xs p-2 border border-stone-300 rounded-lg focus:ring-1 focus:ring-chef-500 outline-none"
                            />
                          </div>

                          <div>
                            <label className="text-xs font-bold text-stone-600 block mb-1">Username (Login ID)</label>
                            <input 
                              type="text" 
                              value={editUsername}
                              onChange={e => setEditUsername(e.target.value)}
                              className="w-full text-xs font-mono p-2 border border-stone-300 rounded-lg focus:ring-1 focus:ring-chef-500 outline-none"
                            />
                          </div>

                          <div>
                            <label className="text-xs font-bold text-stone-600 block mb-1">
                              New Password / PIN <span className="font-normal text-stone-400">(leave blank to keep current)</span>
                            </label>
                            <input 
                              type="password" 
                              value={editPassword}
                              onChange={e => setEditPassword(e.target.value)}
                              placeholder="Enter new password..."
                              className="w-full text-xs p-2 border border-stone-300 rounded-lg focus:ring-1 focus:ring-chef-500 outline-none"
                            />
                          </div>

                          <div>
                            <label className="text-xs font-bold text-stone-600 block mb-1">Avatar Color</label>
                            <div className="flex gap-2 items-center">
                              {['#ea580c', '#0284c7', '#16a34a', '#9333ea', '#e11d48', '#d97706'].map(color => (
                                <button
                                  key={color}
                                  type="button"
                                  onClick={() => setEditColor(color)}
                                  className={`w-6 h-6 rounded-full border-2 transition-transform ${editColor === color ? 'scale-110 border-stone-800' : 'border-transparent'}`}
                                  style={{ backgroundColor: color }}
                                />
                              ))}
                            </div>
                          </div>

                          <div className="flex gap-2 pt-2">
                            <button
                              type="button"
                              onClick={() => setEditingUserId(null)}
                              className="flex-1 py-1.5 text-xs font-semibold bg-stone-100 text-stone-700 rounded-lg hover:bg-stone-200"
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              onClick={() => handleSaveUser(user.id)}
                              className="flex-1 py-1.5 text-xs font-bold bg-chef-600 text-white rounded-lg hover:bg-chef-700 flex items-center justify-center gap-1 shadow-sm"
                            >
                              <Save className="w-3.5 h-3.5" /> Save Changes
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Login info banner */}
              <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-4 text-xs text-amber-900 flex items-start gap-3">
                <Lock className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold mb-1">Dual-User Authentication Rules:</p>
                  <ul className="list-disc pl-4 space-y-0.5 text-amber-800">
                    <li><strong>User 1 (Admin / Head Chef):</strong> Can manage users, trigger backups, and download the raw database file.</li>
                    <li><strong>User 2 (Sous Chef / Member):</strong> Can add/edit recipes, create shopping lists, and manage inventory without administrative risk.</li>
                    <li>Both chefs share the same unified recipes cookbook and inventory database stored in the LXC container volume.</li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: STORAGE CONTAINER & BACKUPS */}
          {activeTab === 'STORAGE' && (
            <div className="space-y-6">
              
              {/* Storage Container Metrics */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-sm">
                  <span className="text-xs font-bold text-stone-400 block mb-1">Total Recipes in Container</span>
                  <span className="text-2xl font-black text-stone-900">{recipes.length}</span>
                  <span className="text-[11px] text-stone-400 block mt-1">Permanent on disk</span>
                </div>
                <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-sm">
                  <span className="text-xs font-bold text-stone-400 block mb-1">Database File Size</span>
                  <span className="text-2xl font-black text-stone-900">
                    {storageStats?.dbSizeBytes ? `${(storageStats.dbSizeBytes / 1024).toFixed(1)} KB` : 'Cached'}
                  </span>
                  <span className="text-[11px] text-stone-400 block mt-1">db.json JSON store</span>
                </div>
                <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-sm">
                  <span className="text-xs font-bold text-stone-400 block mb-1">Container Backups</span>
                  <span className="text-2xl font-black text-stone-900">{backups.length}</span>
                  <span className="text-[11px] text-stone-400 block mt-1">Saved snapshots</span>
                </div>
                <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-sm">
                  <span className="text-xs font-bold text-stone-400 block mb-1">Server Container Status</span>
                  <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-1 rounded-md mt-1 border border-emerald-200">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    Connected & Active
                  </span>
                </div>
              </div>

              {/* Container Volume Details */}
              <div className="bg-white p-5 rounded-xl border border-stone-200 shadow-sm space-y-4">
                <h4 className="font-bold text-stone-900 text-sm flex items-center gap-2">
                  <Database className="w-4 h-4 text-chef-600" />
                  Container Persistent Storage Volume
                </h4>

                <div className="space-y-2 text-xs font-mono">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between p-2.5 bg-stone-50 rounded-lg border border-stone-100 gap-1">
                    <span className="text-stone-500 font-sans font-medium">Container Volume Path (DATA_DIR):</span>
                    <span className="text-stone-900 font-bold bg-white px-2 py-1 rounded border border-stone-200">
                      {storageStats?.containerDataDir || '/var/lib/mpishi/data'}
                    </span>
                  </div>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between p-2.5 bg-stone-50 rounded-lg border border-stone-100 gap-1">
                    <span className="text-stone-500 font-sans font-medium">Primary Database File:</span>
                    <span className="text-stone-900 font-bold bg-white px-2 py-1 rounded border border-stone-200">
                      {storageStats?.dbFilePath || '/var/lib/mpishi/data/db.json'}
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 pt-2">
                  <button
                    onClick={handleCreateSnapshot}
                    className="px-4 py-2 bg-chef-600 hover:bg-chef-700 text-white rounded-lg text-xs font-bold flex items-center gap-2 shadow-sm transition-all"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Take Instant Server Snapshot
                  </button>

                  <a
                    href="/api/storage/download-db"
                    download
                    className="px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-800 rounded-lg text-xs font-bold flex items-center gap-2 border border-stone-300 transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Download db.json Direct From Container
                  </a>
                </div>
              </div>

              {/* Snapshots List */}
              <div className="bg-white p-5 rounded-xl border border-stone-200 shadow-sm space-y-3">
                <h4 className="font-bold text-stone-900 text-sm flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <HardDrive className="w-4 h-4 text-stone-600" />
                    Timestamped Server Snapshots ({backups.length})
                  </span>
                  <span className="text-xs font-normal text-stone-400">Stored in /data/backups</span>
                </h4>

                {backups.length === 0 ? (
                  <div className="text-center py-8 text-stone-400 text-xs">
                    No snapshots created yet. Click "Take Instant Server Snapshot" above to create one.
                  </div>
                ) : (
                  <div className="divide-y divide-stone-100 max-h-56 overflow-y-auto pr-1">
                    {backups.map(bk => (
                      <div key={bk.filename} className="py-2.5 flex items-center justify-between text-xs hover:bg-stone-50 px-2 rounded transition-colors">
                        <div>
                          <span className="font-mono font-bold text-stone-800 block">{bk.filename}</span>
                          <span className="text-[11px] text-stone-400">
                            {new Date(bk.timestamp).toLocaleString()} • {(bk.sizeBytes / 1024).toFixed(1)} KB
                          </span>
                        </div>
                        <button
                          onClick={() => handleRestoreSnapshot(bk.filename)}
                          className="px-3 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded font-bold transition-colors"
                        >
                          Restore
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: LXC CONTAINER & NGINX */}
          {activeTab === 'LXC_NGINX' && (
            <div className="space-y-6">
              <div className="bg-blue-50/70 border border-blue-200 rounded-xl p-4 text-xs text-blue-900">
                <h5 className="font-bold text-sm mb-1 flex items-center gap-2">
                  <Server className="w-4 h-4 text-blue-700" />
                  Self-Hosting in LXC Container Architecture
                </h5>
                <p className="leading-relaxed">
                  Your Sous Chef AI application is designed to run as an independent, lightweight Node.js service on port 3000 behind Nginx inside an LXC container (e.g. Proxmox, LXD, or Ubuntu Server). All recipes, pictures, and user credentials are saved in the persistent storage path on the container's volume.
                </p>
              </div>

              {/* Nginx Config Block */}
              <div className="bg-white rounded-xl border border-stone-200 shadow-sm p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h5 className="font-bold text-stone-900 text-sm">1. Nginx Reverse Proxy Configuration</h5>
                    <p className="text-xs text-stone-500">Save this to <code>/etc/nginx/sites-available/mpishi.conf</code></p>
                  </div>
                  <button
                    onClick={() => handleCopy(nginxConfig, 'nginx')}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-lg text-xs font-bold transition-colors border border-stone-200"
                  >
                    {copiedKey === 'nginx' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    {copiedKey === 'nginx' ? 'Copied!' : 'Copy Config'}
                  </button>
                </div>
                <pre className="bg-stone-900 text-stone-100 p-4 rounded-xl text-xs font-mono overflow-x-auto max-h-64 leading-relaxed">
                  {nginxConfig}
                </pre>
              </div>

              {/* Systemd Service Unit */}
              <div className="bg-white rounded-xl border border-stone-200 shadow-sm p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h5 className="font-bold text-stone-900 text-sm">2. Systemd Service Unit</h5>
                    <p className="text-xs text-stone-500">Save to <code>/etc/systemd/system/mpishi.service</code> for 24/7 autostart</p>
                  </div>
                  <button
                    onClick={() => handleCopy(systemdService, 'systemd')}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-lg text-xs font-bold transition-colors border border-stone-200"
                  >
                    {copiedKey === 'systemd' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    {copiedKey === 'systemd' ? 'Copied!' : 'Copy Service'}
                  </button>
                </div>
                <pre className="bg-stone-900 text-stone-100 p-4 rounded-xl text-xs font-mono overflow-x-auto max-h-64 leading-relaxed">
                  {systemdService}
                </pre>
              </div>

              {/* Container Setup Script */}
              <div className="bg-white rounded-xl border border-stone-200 shadow-sm p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h5 className="font-bold text-stone-900 text-sm">3. LXC Creation & Shell Commands</h5>
                    <p className="text-xs text-stone-500">Fast bootstrap commands for Debian / Ubuntu container</p>
                  </div>
                  <button
                    onClick={() => handleCopy(lxcSetupScript, 'lxc')}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-lg text-xs font-bold transition-colors border border-stone-200"
                  >
                    {copiedKey === 'lxc' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    {copiedKey === 'lxc' ? 'Copied!' : 'Copy Script'}
                  </button>
                </div>
                <pre className="bg-stone-900 text-stone-100 p-4 rounded-xl text-xs font-mono overflow-x-auto max-h-64 leading-relaxed">
                  {lxcSetupScript}
                </pre>
              </div>
            </div>
          )}

          {/* TAB 4: TAILSCALE GUIDE */}
          {activeTab === 'TAILSCALE' && (
            <div className="space-y-6">
              
              {/* Tailscale Hostname Customizer */}
              <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h4 className="font-bold text-stone-900 text-sm flex items-center gap-2">
                    <Globe className="w-4 h-4 text-chef-600" />
                    Your Tailnet MagicDNS Domain
                  </h4>
                  <p className="text-xs text-stone-500">
                    Use your custom Tailscale device name to access Sous Chef from your phone or tablet on the go.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={tailscaleHost}
                    onChange={e => setTailscaleHost(e.target.value)}
                    placeholder="e.g. mpishi.your-tailnet.ts.net"
                    className="text-xs font-mono px-3 py-2 border border-stone-300 rounded-lg focus:ring-1 focus:ring-chef-500 outline-none w-64"
                  />
                </div>
              </div>

              {/* Step by Step Tailscale in LXC */}
              <div className="space-y-4">
                
                {/* Step 1 */}
                <div className="bg-white p-5 rounded-xl border border-stone-200 shadow-sm space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-chef-100 text-chef-700 font-black text-xs flex items-center justify-center">1</span>
                    <h5 className="font-bold text-stone-900 text-sm">Enable TUN / TAP in LXC (Proxmox host)</h5>
                  </div>
                  <p className="text-xs text-stone-600 pl-8">
                    Tailscale requires TUN device access. If using an unprivileged Proxmox LXC container, add these lines to <code>/etc/pve/lxc/&lt;CTID&gt;.conf</code>:
                  </p>
                  <pre className="bg-stone-900 text-stone-200 p-3 rounded-lg text-xs font-mono ml-8 overflow-x-auto">
{`lxc.cgroup2.devices.allow: c 10:200 rwm
lxc.mount.entry: /dev/net/tun dev/net/tun none bind,create=file`}
                  </pre>
                </div>

                {/* Step 2 */}
                <div className="bg-white p-5 rounded-xl border border-stone-200 shadow-sm space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-chef-100 text-chef-700 font-black text-xs flex items-center justify-center">2</span>
                    <h5 className="font-bold text-stone-900 text-sm">Install Tailscale Inside the LXC Container</h5>
                  </div>
                  <pre className="bg-stone-900 text-stone-200 p-3 rounded-lg text-xs font-mono ml-8 overflow-x-auto">
{`curl -fsSL https://tailscale.com/install.sh | sh
tailscale up --ssh`}
                  </pre>
                  <p className="text-xs text-stone-500 pl-8">
                    Follow the browser authentication link to connect your container to your Tailnet.
                  </p>
                </div>

                {/* Step 3 */}
                <div className="bg-white p-5 rounded-xl border border-stone-200 shadow-sm space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-chef-100 text-chef-700 font-black text-xs flex items-center justify-center">3</span>
                    <h5 className="font-bold text-stone-900 text-sm">Generate Free HTTPS SSL Certificate with Tailscale</h5>
                  </div>
                  <p className="text-xs text-stone-600 pl-8">
                    Tailscale provides free, automatic Let's Encrypt TLS certificates for MagicDNS domains:
                  </p>
                  <pre className="bg-stone-900 text-stone-200 p-3 rounded-lg text-xs font-mono ml-8 overflow-x-auto">
{`# Inside LXC container:
mkdir -p /var/lib/tailscale/certs
tailscale cert --cert-file=/var/lib/tailscale/certs/${tailscaleHost}.crt --key-file=/var/lib/tailscale/certs/${tailscaleHost}.key ${tailscaleHost}`}
                  </pre>
                </div>

                {/* Step 4 */}
                <div className="bg-white p-5 rounded-xl border border-stone-200 shadow-sm space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-chef-100 text-chef-700 font-black text-xs flex items-center justify-center">4</span>
                    <h5 className="font-bold text-stone-900 text-sm">Access on Mobile Devices & Tablets</h5>
                  </div>
                  <p className="text-xs text-stone-600 pl-8">
                    Install the Tailscale app on your iPhone, Android, or iPad. Once connected to your Tailnet, navigate to:
                  </p>
                  <div className="ml-8 p-3 bg-chef-50 rounded-lg border border-chef-200 flex items-center justify-between">
                    <span className="font-mono font-bold text-chef-900 text-xs">
                      http://{tailscaleHost} &nbsp;or&nbsp; https://{tailscaleHost}
                    </span>
                    <span className="text-[11px] bg-chef-600 text-white font-bold px-2 py-0.5 rounded">
                      Zero Port Forwarding Needed
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="p-4 bg-white border-t border-stone-200 flex justify-between items-center shrink-0">
          <div className="text-xs text-stone-500 flex items-center gap-1.5">
            <Shield className="w-4 h-4 text-chef-600" />
            Local-First Self-Hosted Node.js Service
          </div>
          <button
            onClick={onClose}
            className="px-5 py-2 bg-stone-900 hover:bg-stone-800 text-white rounded-xl text-xs font-bold transition-colors"
          >
            Close Console
          </button>
        </div>

      </div>
    </div>
  );
};

export default AdminConsole;

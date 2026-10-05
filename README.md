# LabShare 🔬📂💬

> **Complete self-hosted communication and file-sharing platform designed specifically for college and university laboratory environments.**

[![GitHub Pages Deployment](https://github.com/Santhosh061117/LabShare/actions/workflows/deploy.yml/badge.svg)](https://github.com/Santhosh061117/LabShare/actions/workflows/deploy.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Platform: Termux](https://img.shields.io/badge/Host-Android%20Termux-green.svg)](https://termux.dev)

---

## 🏛 Architecture Overview

LabShare separates the **client interface** from the **data host** to maintain complete privacy and control while enabling zero-cost static hosting:

```
                  ┌──────────────────────────────────────────────┐
                  │          GitHub Pages Static Host            │
                  │   React 19 + TypeScript + Vite + PWA Shell   │
                  │  (Never stores files or backend credentials) │
                  └──────────────────────┬───────────────────────┘
                                         │ HTTPS / WSS
                                         ▼
                  ┌──────────────────────────────────────────────┐
                  │       Stable Custom Hostname (Cloudflare)     │
                  │             lab.yourdomain.com               │
                  └──────────────────────┬───────────────────────┘
                                         │ Cloudflare Named Tunnel
                                         ▼
                  ┌──────────────────────────────────────────────┐
                  │            Android Device (Termux)           │
                  │  ┌────────────────────────────────────────┐  │
                  │  │         cloudflared tunnel run         │  │
                  │  └───────────────────┬────────────────────┘  │
                  │                      ▼                       │
                  │  ┌────────────────────────────────────────┐  │
                  │  │        Node.js Backend (:3000)         │  │
                  │  │  - Express REST + WebSocket Server     │  │
                  │  │  - SQLite Database (WAL Mode)          │  │
                  │  │  - Resumable Chunk Streaming Storage   │  │
                  │  │  - Automatic Expired TTL Cleanup       │  │
                  │  └────────────────────────────────────────┘  │
                  │                                              │
                  │  Local Storage: ~/.labshare                  │
                  │  (All messages, files & media remain local)  │
                  └──────────────────────────────────────────────┘
```

---

## ✨ Key Features

### 1. ⚡ Quick Transfer Mode
- Dedicated rapid transfer mode built for college labs.
- **Phone A** clicks *Create Quick Room* $\rightarrow$ displays QR code & 6-digit PIN.
- **Phone B** scans QR or enters PIN $\rightarrow$ both devices connect instantly.
- Transfer images, code, videos, and clipboard snippets with real-time delivery.
- Temporary files and rooms are **automatically deleted** after the session expires.

### 2. 🛡 Trusted Devices & QR Pairing
- **"Trust this device"**: Prevents students from having to log in repeatedly during college labs (valid for 180 days).
- **Device Management**: View active sessions, browser names, and IP addresses. Revoke individual sessions or log out all devices remotely.
- **QR Computer Pairing**: A shared lab desktop generates a QR code/PIN; scan with your logged-in phone to sign in the computer without typing credentials on shared keyboards.

### 3. 👥 Lab Rooms & Real-Time Messaging
- Create persistent or temporary lab rooms with custom codes (e.g. `LAB-402`).
- Optional room passwords, member limits, and owner controls (kick members, close rooms).
- Real-time chat:
  - Replies with message preview
  - Emoji reactions with live counter
  - Message pinning for lab announcements
  - Star / bookmark important messages
  - Message search and edit/delete actions
  - Typing indicator and presence detection

### 4. 📁 Large File Sharing & Streaming
- Supports any file type: C/C++, Java, Python, Verilog (`.v`, `.sv`), Quartus project files (`.qpf`, `.qsf`), PDFs, ZIPs, Videos, and Audio.
- **Chunked Resumable Streaming**: Files are uploaded in 5MB slices directly to disk, avoiding high RAM usage in Termux.
- **In-Browser Video & Audio Streaming**: Full HTTP 206 Partial Content Range support for seeking large media.
- **Syntax Text Viewer**: Inspect code files directly in the browser.

### 5. 📋 Room Clipboard Snippets
- Share code snippets, commands, or text between students with one-click copy.
- Explicit user trigger only — never secretly reads your system clipboard.

### 6. 📊 Storage Manager & Auto-Cleanup
- Live storage footprint meter on the Termux device.
- Top largest files inspector with manual deletion.
- Background worker sweeps expired files and rooms automatically every 10 minutes.

### 7. 📱 Progressive Web App (PWA)
- Installable on Android, iOS, Windows, Mac, and Linux.
- Offline app shell cached via service worker.
- Clearly flags when the Termux backend is offline:
  > **"Termux server is offline. Start LabShare in Termux."**

---

## 🚀 Quick Start on Android (Termux)

### Prerequisites in Termux
Open Termux and run:
```bash
# Clone the repository
git clone https://github.com/Santhosh061117/LabShare.git
cd LabShare
```

### 1. Run Setup Script
```bash
./setup.sh
```
`./setup.sh` will:
1. Verify storage permissions (`termux-setup-storage`).
2. Install Node.js (`pkg install nodejs-lts`).
3. Auto-download the appropriate `cloudflared` binary for your Android CPU architecture.
4. Install backend dependencies and compile TypeScript.
5. Generate a secure random `JWT_SECRET` in `backend/.env`.

### 2. Configure Cloudflare Named Tunnel
For a permanent, stable HTTPS hostname (e.g. `https://lab.yourdomain.com`):

1. Authenticate Cloudflare:
   ```bash
   cloudflared tunnel login
   ```
2. Create a named tunnel:
   ```bash
   cloudflared tunnel create labshare
   ```
3. Route DNS to your domain:
   ```bash
   cloudflared tunnel route dns labshare lab.yourdomain.com
   ```
4. Copy and edit `cloudflare/config.yml`:
   ```bash
   cp cloudflare/config.example.yml cloudflare/config.yml
   nano cloudflare/config.yml
   ```
   *(See [cloudflare/README.md](cloudflare/README.md) for detailed configuration).*

### 3. Start LabShare
```bash
./start.sh
```
`start.sh` will:
- Check dependencies
- Start the Node.js backend
- Verify backend health via `/api/health`
- Launch your Cloudflare Named Tunnel
- Display local and public URLs

### Service Management Scripts
- `./status.sh` — Inspect backend PID, tunnel PID, health, and disk usage
- `./stop.sh` — Gracefully stop backend and tunnel
- `./restart.sh` — Restart all services cleanly

---

## 🌐 GitHub Pages Frontend Deployment

The frontend is deployed automatically via GitHub Actions upon pushes to `main`:

1. In your GitHub repository: **Settings $\rightarrow$ Pages $\rightarrow$ Build and deployment**.
2. Select **Source**: `GitHub Actions`.
3. In the frontend web app, click the **Settings (gear icon)** or the **Server Status Badge** to enter your Cloudflare tunnel domain (e.g. `https://lab.yourdomain.com`).
4. The backend URL is remembered in browser `localStorage`, allowing any student or group to connect their static GitHub Pages app to their own Termux backend without rebuilding code!

---

## 🔒 Security & Privacy Architecture

- **Zero Plaintext Passwords**: Passwords hashed using bcrypt.
- **Session Tokens**: Salted SHA-256 tokens stored securely.
- **Path Traversal Protection**: File paths are strictly validated to stay within `UPLOADS_DIR`.
- **CORS & Rate Limiting**: In-memory sliding-window rate limiters prevent API and auth abuse.
- **Zero Cloud Leakage**: No user files or messages are ever uploaded to GitHub or external cloud databases. Everything lives in SQLite and the filesystem on your Android device.
- **Data Export & Deletion**: One-click JSON data export and permanent account deletion under Settings.

---

## 📜 License

MIT License © 2026 Santhosh R ([Santhosh061117](https://github.com/Santhosh061117))

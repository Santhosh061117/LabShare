# Cloudflare Named Tunnel Setup Guide for LabShare

This guide walks you through setting up a **stable, permanent Cloudflare Named Tunnel** for your LabShare instance running inside Termux on Android.

---

## Why a Named Tunnel?

- **Permanent Hostname**: Your domain (e.g. `https://lab.yourdomain.com` or `https://labshare.yourdomain.com`) stays the same forever.
- **Never changes**: Unlike temporary `trycloudflare.com` Quick Tunnels that change randomly upon every restart, Named Tunnels are permanent.
- **Full HTTPS & WebSockets**: Automatic valid SSL certificate handled by Cloudflare Edge with built-in WebSocket support.
- **GitHub Pages Compatibility**: The static GitHub Pages frontend can be configured once to point to your stable tunnel hostname.

---

## Step 1: Install `cloudflared` on Android (Termux)

If you ran `./setup.sh`, `cloudflared` was automatically downloaded. Otherwise:

```bash
# In Termux:
ARCH=$(uname -m)
if [ "$ARCH" = "aarch64" ]; then
    curl -L -o $PREFIX/bin/cloudflared https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-arm64
fi
chmod +x $PREFIX/bin/cloudflared
cloudflared --version
```

---

## Step 2: Authenticate Cloudflare in Termux

Run:
```bash
cloudflared tunnel login
```
This prints an authentication URL in Termux. Open the link in Chrome/Firefox on your Android device and select your domain name.
Cloudflare will download your certificate file into:
`~/.cloudflared/cert.pem`

---

## Step 3: Create Your Named Tunnel

Create a tunnel named `labshare`:
```bash
cloudflared tunnel create labshare
```
Output will display your Tunnel ID:
```
Created tunnel labshare with id 7a2b9c1d-1234-5678-9abc-def012345678
```
A credentials file will be generated at `~/.cloudflared/<TUNNEL_ID>.json`.

---

## Step 4: Route DNS to Your Tunnel

Route your custom domain (e.g., `lab.yourdomain.com`) to this tunnel:
```bash
cloudflared tunnel route dns labshare lab.yourdomain.com
```

---

## Step 5: Configure `cloudflare/config.yml`

Copy the template:
```bash
cp cloudflare/config.example.yml cloudflare/config.yml
```

Edit `cloudflare/config.yml` with `nano cloudflare/config.yml`:
```yaml
tunnel: 7a2b9c1d-1234-5678-9abc-def012345678
credentials-file: /data/data/com.termux/files/home/.cloudflared/7a2b9c1d-1234-5678-9abc-def012345678.json

ingress:
  - hostname: lab.yourdomain.com
    service: http://localhost:3000
  - service: http_status:404
```

---

## Step 6: Test the Tunnel

Now start LabShare:
```bash
./start.sh
```

`start.sh` will:
1. Verify the Node.js backend is healthy at `http://localhost:3000/api/health`.
2. Automatically launch your Cloudflare Named Tunnel using `cloudflare/config.yml`.
3. Display your permanent HTTPS URL `https://lab.yourdomain.com`!

### Alternative: Using Cloudflare Zero Trust Dashboard Token
If you created a tunnel in the Cloudflare Zero Trust web dashboard (Access > Tunnels), you can simply put your tunnel token in `backend/.env`:
```
CLOUDFLARE_TUNNEL_TOKEN=eyJhIjoi...
```
`./start.sh` will automatically detect `CLOUDFLARE_TUNNEL_TOKEN` and start the tunnel!

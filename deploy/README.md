# Analytics Dashboard — VPS Deployment Guide

Run the full dashboard on any Linux VPS using Docker.

## Requirements
- Linux VPS (Ubuntu 20.04+ recommended)
- 512MB RAM minimum
- MongoDB URI (Atlas or self-hosted)
- Docker (auto-installed by setup script)

---

## Quick Setup (Recommended)

```bash
# 1. Clone the repo on your VPS
git clone https://github.com/MikoxYae/Analysis-Dashboard.git
cd Analysis-Dashboard

# 2. Run the auto-setup script (installs Docker if needed)
bash deploy/setup.sh
```

The script will:
- Install Docker automatically if missing
- Create `.env` from `.env.example`
- Ask you to fill in `MONGODB_URI`
- Build and start the container

---

## Manual Setup

```bash
# 1. Clone
git clone https://github.com/MikoxYae/Analysis-Dashboard.git
cd Analysis-Dashboard

# 2. Create .env
cp .env.example .env
nano .env   # Add your MONGODB_URI

# 3. Build and start
docker compose build
docker compose up -d

# 4. Open in browser
http://YOUR_VPS_IP:3000
```

---

## .env Options

```env
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/
HOST_PORT=3000    # change if port 3000 is taken
```

---

## Useful Commands

| Command | Description |
|---------|-------------|
| `docker compose up -d` | Start in background |
| `docker compose down` | Stop |
| `docker compose logs -f` | View live logs |
| `docker compose restart` | Restart |
| `docker compose build --no-cache` | Rebuild after code changes |

---

## Update to Latest Version

```bash
git pull
docker compose build --no-cache
docker compose up -d
```

---

## Reverse Proxy (nginx) — Optional

If you want to serve on port 80 with a domain:

```nginx
server {
    listen 80;
    server_name yourdomain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

For HTTPS, use Certbot: `certbot --nginx -d yourdomain.com`

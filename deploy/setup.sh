#!/bin/bash
set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${GREEN}"
echo "╔══════════════════════════════════════╗"
echo "║   Analytics Dashboard - VPS Setup   ║"
echo "╚══════════════════════════════════════╝"
echo -e "${NC}"

# ─── Check Docker ─────────────────────────────────────────────────────────────
if ! command -v docker &>/dev/null; then
  echo -e "${YELLOW}Docker not found. Installing...${NC}"
  curl -fsSL https://get.docker.com | sh
  systemctl enable docker
  systemctl start docker
  echo -e "${GREEN}✓ Docker installed${NC}"
else
  echo -e "${GREEN}✓ Docker found: $(docker --version)${NC}"
fi

# ─── Check Docker Compose ─────────────────────────────────────────────────────
if ! docker compose version &>/dev/null 2>&1; then
  echo -e "${YELLOW}Installing Docker Compose plugin...${NC}"
  apt-get update -qq && apt-get install -y -qq docker-compose-plugin
fi
echo -e "${GREEN}✓ Docker Compose ready${NC}"

# ─── Go to project root ───────────────────────────────────────────────────────
cd "$(dirname "$0")/.."

# ─── Create .env if missing ───────────────────────────────────────────────────
if [ ! -f .env ]; then
  cp .env.example .env
  echo ""
  echo -e "${YELLOW}⚠  .env file created. Please add your MongoDB URI:${NC}"
  echo ""
  echo "   nano .env"
  echo ""
  echo "Then re-run this script: bash deploy/setup.sh"
  exit 0
fi

# ─── Check MONGODB_URI is set ─────────────────────────────────────────────────
if ! grep -q "^MONGODB_URI=mongodb" .env; then
  echo -e "${RED}✗ MONGODB_URI not set in .env${NC}"
  echo "  Edit .env and add:  MONGODB_URI=mongodb+srv://..."
  exit 1
fi
echo -e "${GREEN}✓ .env configured${NC}"

# ─── Build and start ──────────────────────────────────────────────────────────
echo ""
echo -e "${YELLOW}Building Docker image (first time may take 3-5 min)...${NC}"
docker compose build --no-cache

echo ""
echo -e "${YELLOW}Starting container...${NC}"
docker compose up -d

PORT=$(grep HOST_PORT .env 2>/dev/null | cut -d= -f2 || echo 3000)
PORT=${PORT:-3000}

echo ""
echo -e "${GREEN}╔══════════════════════════════════════╗"
echo "║         ✅ Setup Complete!           ║"
echo "╚══════════════════════════════════════╝${NC}"
echo ""
echo -e "  Dashboard: ${GREEN}http://$(curl -s ifconfig.me 2>/dev/null || echo YOUR_VPS_IP):${PORT}${NC}"
echo ""
echo "  Commands:"
echo "    View logs  : docker compose logs -f"
echo "    Stop       : docker compose down"
echo "    Restart    : docker compose restart"
echo "    Update     : git pull && bash deploy/setup.sh"
echo ""

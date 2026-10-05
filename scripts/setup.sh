#!/bin/bash
# ============================================================
# LabShare - Termux & Linux Setup Script
# ============================================================

set -e

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}====================================================${NC}"
echo -e "${GREEN}          LabShare Environment Setup                ${NC}"
echo -e "${BLUE}====================================================${NC}"

# Detect Termux
IS_TERMUX=false
if [ -n "$TERMUX_VERSION" ] || [ -d "/data/data/com.termux" ]; then
    IS_TERMUX=true
    echo -e "${GREEN}✓ Detected Android Termux environment${NC}"
fi

# 1. Android storage permissions in Termux
if [ "$IS_TERMUX" = true ]; then
    if [ ! -d "$HOME/storage" ]; then
        echo -e "${YELLOW}Requesting Android storage permissions (termux-setup-storage)...${NC}"
        termux-setup-storage || true
    fi
fi

# 2. Check / Install Node.js
echo -e "\n${BLUE}[1/4] Checking Node.js...${NC}"
if ! command -v node >/dev/null 2>&1; then
    echo -e "${YELLOW}Node.js not found. Installing...${NC}"
    if [ "$IS_TERMUX" = true ]; then
        pkg update -y && pkg install nodejs-lts -y
    elif command -v apt >/dev/null 2>&1; then
        sudo apt update && sudo apt install -y nodejs npm
    else
        echo -e "${RED}Please install Node.js (v20+) manually on your system.${NC}"
        exit 1
    fi
fi
NODE_VER=$(node -v)
echo -e "${GREEN}✓ Node.js installed: $NODE_VER${NC}"

# 3. Check / Install cloudflared
echo -e "\n${BLUE}[2/4] Checking Cloudflare Tunnel (cloudflared)...${NC}"
if ! command -v cloudflared >/dev/null 2>&1; then
    echo -e "${YELLOW}cloudflared not found.${NC}"
    if [ "$IS_TERMUX" = true ]; then
        ARCH=$(uname -m)
        echo -e "Detecting architecture: $ARCH"
        CF_BIN_URL=""
        if [ "$ARCH" = "aarch64" ]; then
            CF_BIN_URL="https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-arm64"
        elif [ "$ARCH" = "armv7l" ] || [ "$ARCH" = "arm" ]; then
            CF_BIN_URL="https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-arm"
        elif [ "$ARCH" = "x86_64" ]; then
            CF_BIN_URL="https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64"
        fi

        if [ -n "$CF_BIN_URL" ]; then
            echo -e "${BLUE}Downloading cloudflared for $ARCH...${NC}"
            curl -L -o "$PREFIX/bin/cloudflared" "$CF_BIN_URL"
            chmod +x "$PREFIX/bin/cloudflared"
            echo -e "${GREEN}✓ Installed cloudflared to $PREFIX/bin/cloudflared${NC}"
        else
            echo -e "${YELLOW}Could not auto-download cloudflared for $ARCH. Please install via: pkg install cloudflared${NC}"
        fi
    else
        echo -e "${YELLOW}To install cloudflared on Linux, see: https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/${NC}"
    fi
else
    CF_VER=$(cloudflared --version 2>&1 | head -n 1)
    echo -e "${GREEN}✓ cloudflared found: $CF_VER${NC}"
fi

# 4. Configure Backend Environment
echo -e "\n${BLUE}[3/4] Setting up Backend Configuration...${NC}"
cd "$(dirname "$0")/../backend"

if [ ! -f ".env" ]; then
    echo -e "Creating .env from .env.example..."
    cp .env.example .env
    # Generate random secret
    RAND_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
    sed -i "s/replace-with-a-random-secure-secret-key-32-chars-min/$RAND_SECRET/" .env 2>/dev/null || true
    echo -e "${GREEN}✓ Generated secure JWT_SECRET in backend/.env${NC}"
fi

# 5. Install Backend Dependencies & Build
echo -e "\n${BLUE}[4/4] Installing dependencies and building backend...${NC}"
npm install
npm run build

echo -e "\n${GREEN}====================================================${NC}"
echo -e "${GREEN}  ✓ LabShare Setup Completed Successfully!           ${NC}"
echo -e "${GREEN}====================================================${NC}"
echo -e "You can now run:"
echo -e "  ${YELLOW}./start.sh${NC}      - To start LabShare and Cloudflare Tunnel"
echo -e "  ${YELLOW}./status.sh${NC}     - To check service health and storage"
echo -e "  ${YELLOW}./stop.sh${NC}       - To stop services cleanly"

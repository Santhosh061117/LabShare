#!/bin/bash
# ============================================================
# LabShare - Start Server & Cloudflare Named Tunnel
# ============================================================

set -e

# Change directory to project root
PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BACKEND_DIR="$PROJECT_ROOT/backend"
CLOUDFLARE_DIR="$PROJECT_ROOT/cloudflare"
PID_DIR="$PROJECT_ROOT/.run"
mkdir -p "$PID_DIR"

BACKEND_PID_FILE="$PID_DIR/backend.pid"
TUNNEL_PID_FILE="$PID_DIR/tunnel.pid"

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BOLD='\033[1m'
NC='\033[0m'

echo -e "${BLUE}====================================================${NC}"
echo -e "${GREEN}${BOLD}           Starting LabShare System...              ${NC}"
echo -e "${BLUE}====================================================${NC}"

# Cleanup handler on exit or Ctrl+C
cleanup() {
    echo -e "\n${YELLOW}[Shutdown] Stopping LabShare services...${NC}"
    if [ -f "$BACKEND_PID_FILE" ]; then
        PID=$(cat "$BACKEND_PID_FILE")
        if kill -0 "$PID" 2>/dev/null; then
            echo -e "Stopping Node.js backend (PID $PID)..."
            kill "$PID" 2>/dev/null || true
        fi
        rm -f "$BACKEND_PID_FILE"
    fi

    if [ -f "$TUNNEL_PID_FILE" ]; then
        PID=$(cat "$TUNNEL_PID_FILE")
        if kill -0 "$PID" 2>/dev/null; then
            echo -e "Stopping Cloudflare Tunnel (PID $PID)..."
            kill "$PID" 2>/dev/null || true
        fi
        rm -f "$TUNNEL_PID_FILE"
    fi
    echo -e "${GREEN}✓ LabShare shutdown completed.${NC}"
    exit 0
}

trap cleanup SIGINT SIGTERM EXIT

# 1. Dependency checks
if ! command -v node >/dev/null 2>&1; then
    echo -e "${RED}Error: Node.js is not installed. Run ./setup.sh first.${NC}"
    exit 1
fi

# Load backend configuration
if [ -f "$BACKEND_DIR/.env" ]; then
    export $(grep -v '^#' "$BACKEND_DIR/.env" | xargs)
fi

PORT="${PORT:-3000}"

# 2. Check if already running
if [ -f "$BACKEND_PID_FILE" ]; then
    OLD_PID=$(cat "$BACKEND_PID_FILE")
    if kill -0 "$OLD_PID" 2>/dev/null; then
        echo -e "${YELLOW}Warning: Backend is already running with PID $OLD_PID.${NC}"
        echo -e "Run ./stop.sh or ./restart.sh if you wish to restart."
        exit 0
    fi
fi

# 3. Start Node.js Backend
echo -e "\n${BLUE}[1/3] Launching Node.js backend on port $PORT...${NC}"
cd "$BACKEND_DIR"

if [ ! -d "dist" ]; then
    echo -e "${YELLOW}Building backend TypeScript...${NC}"
    npm run build
fi

node dist/index.js > "$PID_DIR/backend.log" 2>&1 &
BACKEND_PID=$!
echo "$BACKEND_PID" > "$BACKEND_PID_FILE"

# 4. Verify Backend Health
echo -e "${BLUE}[2/3] Checking backend health on http://localhost:$PORT/api/health...${NC}"
MAX_RETRIES=20
COUNT=0
HEALTHY=false

while [ $COUNT -lt $MAX_RETRIES ]; do
    if curl -s "http://localhost:$PORT/api/health" | grep -q '"status":"ok"'; then
        HEALTHY=true
        break
    fi
    sleep 0.5
    COUNT=$((COUNT+1))
done

if [ "$HEALTHY" = true ]; then
    echo -e "${GREEN}✓ Backend is healthy and responding! (PID: $BACKEND_PID)${NC}"
else
    echo -e "${RED}Error: Backend failed to respond to /api/health within timeout.${NC}"
    echo -e "Check backend logs at: $PID_DIR/backend.log"
    cat "$PID_DIR/backend.log" | tail -n 20
    exit 1
fi

# 5. Start Cloudflare Named Tunnel
echo -e "\n${BLUE}[3/3] Checking Cloudflare Tunnel...${NC}"
CF_CONFIG_FILE="$CLOUDFLARE_DIR/config.yml"

if command -v cloudflared >/dev/null 2>&1; then
    if [ -f "$CF_CONFIG_FILE" ]; then
        echo -e "${GREEN}Found Cloudflare tunnel config: $CF_CONFIG_FILE${NC}"
        cloudflared tunnel --config "$CF_CONFIG_FILE" run > "$PID_DIR/tunnel.log" 2>&1 &
        TUNNEL_PID=$!
        echo "$TUNNEL_PID" > "$TUNNEL_PID_FILE"
        echo -e "${GREEN}✓ Cloudflare Named Tunnel started! (PID: $TUNNEL_PID)${NC}"
    elif [ -n "$CLOUDFLARE_TUNNEL_TOKEN" ]; then
        echo -e "${GREEN}Starting Cloudflare Tunnel using token from environment...${NC}"
        cloudflared tunnel run --token "$CLOUDFLARE_TUNNEL_TOKEN" > "$PID_DIR/tunnel.log" 2>&1 &
        TUNNEL_PID=$!
        echo "$TUNNEL_PID" > "$TUNNEL_PID_FILE"
        echo -e "${GREEN}✓ Cloudflare Tunnel started with token! (PID: $TUNNEL_PID)${NC}"
    else
        echo -e "${YELLOW}Notice: No cloudflare/config.yml or CLOUDFLARE_TUNNEL_TOKEN found.${NC}"
        echo -e "To configure a stable named tunnel, see: ${BOLD}cloudflare/README.md${NC}"
        echo -e "The local backend is running and available on your local Wi-Fi / LAN."
    fi
else
    echo -e "${YELLOW}cloudflared binary not found in PATH.${NC}"
    echo -e "Backend is accessible locally, but not exposed through Cloudflare yet."
    echo -e "Run ./setup.sh to auto-install cloudflared."
fi

# Get Local IP
LOCAL_IP=$(ip route get 1.1.1.1 2>/dev/null | awk '{print $7}' || hostname -I 2>/dev/null | awk '{print $1}' || echo "localhost")

echo -e "\n${GREEN}====================================================${NC}"
echo -e "${GREEN}${BOLD}         ✓ LabShare is Active and Running!         ${NC}"
echo -e "${GREEN}====================================================${NC}"
echo -e "  Local URL:        ${BOLD}http://localhost:$PORT${NC}"
echo -e "  Lab / Wi-Fi URL:  ${BOLD}http://$LOCAL_IP:$PORT${NC}"
echo -e "  Health Endpoint:  http://localhost:$PORT/api/health"
if [ -f "$CF_CONFIG_FILE" ]; then
    HOSTNAME=$(grep -A 1 'hostname:' "$CF_CONFIG_FILE" | head -n 1 | awk '{print $2}' || echo "configured hostname")
    echo -e "  Cloudflare URL:   ${BOLD}https://$HOSTNAME${NC}"
fi
echo -e "===================================================="
echo -e "Press ${BOLD}Ctrl+C${NC} to stop the server cleanly, or run in background with: ./status.sh"

# Keep script running to monitor logs and capture Ctrl+C
wait $BACKEND_PID

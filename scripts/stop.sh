#!/bin/bash
# ============================================================
# LabShare - Stop Services
# ============================================================

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PID_DIR="$PROJECT_ROOT/.run"

BACKEND_PID_FILE="$PID_DIR/backend.pid"
TUNNEL_PID_FILE="$PID_DIR/tunnel.pid"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${YELLOW}Stopping LabShare services...${NC}"

# Stop Backend
if [ -f "$BACKEND_PID_FILE" ]; then
    PID=$(cat "$BACKEND_PID_FILE")
    if kill -0 "$PID" 2>/dev/null; then
        echo -e "Stopping Node.js backend (PID: $PID)..."
        kill "$PID" 2>/dev/null || true
        # Wait up to 5 seconds
        for i in {1..10}; do
            if ! kill -0 "$PID" 2>/dev/null; then
                break
            fi
            sleep 0.5
        done
        # Force kill if still running
        if kill -0 "$PID" 2>/dev/null; then
            echo -e "${RED}Force killing backend...${NC}"
            kill -9 "$PID" 2>/dev/null || true
        fi
    fi
    rm -f "$BACKEND_PID_FILE"
    echo -e "${GREEN}✓ Backend stopped.${NC}"
else
    echo -e "No backend PID file found."
fi

# Stop Cloudflare Tunnel
if [ -f "$TUNNEL_PID_FILE" ]; then
    PID=$(cat "$TUNNEL_PID_FILE")
    if kill -0 "$PID" 2>/dev/null; then
        echo -e "Stopping Cloudflare Tunnel (PID: $PID)..."
        kill "$PID" 2>/dev/null || true
    fi
    rm -f "$TUNNEL_PID_FILE"
    echo -e "${GREEN}✓ Cloudflare Tunnel stopped.${NC}"
else
    echo -e "No tunnel PID file found."
fi

echo -e "${GREEN}✓ All LabShare services are stopped.${NC}"

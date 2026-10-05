#!/bin/bash
# ============================================================
# LabShare - Status Checker
# ============================================================

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BACKEND_DIR="$PROJECT_ROOT/backend"
PID_DIR="$PROJECT_ROOT/.run"

BACKEND_PID_FILE="$PID_DIR/backend.pid"
TUNNEL_PID_FILE="$PID_DIR/tunnel.pid"

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BOLD='\033[1m'
NC='\033[0m'

echo -e "${BLUE}====================================================${NC}"
echo -e "${GREEN}${BOLD}              LabShare System Status                ${NC}"
echo -e "${BLUE}====================================================${NC}"

# Check Backend Process
BACKEND_RUNNING=false
if [ -f "$BACKEND_PID_FILE" ]; then
    PID=$(cat "$BACKEND_PID_FILE")
    if kill -0 "$PID" 2>/dev/null; then
        BACKEND_RUNNING=true
        echo -e "Backend Server:   ${GREEN}ONLINE${NC} (PID: $PID)"
    fi
fi

if [ "$BACKEND_RUNNING" = false ]; then
    echo -e "Backend Server:   ${RED}OFFLINE${NC}"
fi

# Check Tunnel Process
TUNNEL_RUNNING=false
if [ -f "$TUNNEL_PID_FILE" ]; then
    PID=$(cat "$TUNNEL_PID_FILE")
    if kill -0 "$PID" 2>/dev/null; then
        TUNNEL_RUNNING=true
        echo -e "Cloudflare Tunnel:${GREEN}ONLINE${NC} (PID: $PID)"
    fi
fi

if [ "$TUNNEL_RUNNING" = false ]; then
    echo -e "Cloudflare Tunnel:${YELLOW}NOT RUNNING${NC}"
fi

# Load Port
if [ -f "$BACKEND_DIR/.env" ]; then
    export $(grep -v '^#' "$BACKEND_DIR/.env" | xargs)
fi
PORT="${PORT:-3000}"

# Query /api/health
if [ "$BACKEND_RUNNING" = true ]; then
    echo -e "\n${BLUE}Health & Metrics Query:${NC}"
    HEALTH_DATA=$(curl -s "http://localhost:$PORT/api/health" || echo "")
    if [ -n "$HEALTH_DATA" ]; then
        echo -e "$HEALTH_DATA" | grep -o '"status":"[^"]*"' || true
        echo -e "$HEALTH_DATA" | grep -o '"uptimeSeconds":[0-9]*' || true
        echo -e "$HEALTH_DATA" | grep -o '"connectedClients":[0-9]*' || true
        echo -e "$HEALTH_DATA" | grep -o '"activeRooms":[0-9]*' || true
        echo -e "$HEALTH_DATA" | grep -o '"storageUsedBytes":[0-9]*' || true
        echo -e "$HEALTH_DATA" | grep -o '"totalFiles":[0-9]*' || true
    else
        echo -e "${RED}Health endpoint unresponsive.${NC}"
    fi
fi

# Check storage directory usage
DATA_DIR="${LABSHARE_DATA_DIR:-$HOME/.labshare}"
if [ -d "$DATA_DIR" ]; then
    echo -e "\n${BLUE}Storage Footprint:${NC}"
    du -sh "$DATA_DIR" 2>/dev/null || echo "Data directory: $DATA_DIR"
fi

echo -e "===================================================="

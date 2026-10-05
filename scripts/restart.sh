#!/bin/bash
# ============================================================
# LabShare - Restart Services
# ============================================================

SCRIPTS_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "Restarting LabShare..."
"$SCRIPTS_DIR/stop.sh"
sleep 1
"$SCRIPTS_DIR/start.sh"

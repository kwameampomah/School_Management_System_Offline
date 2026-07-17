#!/bin/bash
# ============================================================
#       Ghana GES School Report Manager Startup (macOS)
# ============================================================

echo "=========================================================="
echo "      Ghana GES School Report Manager Startup"
echo "=========================================================="
echo ""

# ── [1/6] Clean up old server processes on ports 3000, 8085, 5433 ──
echo "[1/6] Cleaning up old server processes..."
for PORT in 8085 3000 5433; do
    PIDS=$(lsof -ti tcp:$PORT 2>/dev/null)
    if [ -n "$PIDS" ]; then
        echo "  Killing process(es) on port $PORT: $PIDS"
        echo "$PIDS" | xargs kill -9 2>/dev/null
    fi
done
sleep 1
echo "Done."
echo ""

# ── [2/6] Detect local IP address ──
echo "[2/6] Detecting local IP address..."
LOCAL_IP=$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || echo "127.0.0.1")
echo "Local Server IP detected as: $LOCAL_IP"
echo ""

# ── [3/6] Check / start PostgreSQL on port 5433 ──
echo "[3/6] Checking PostgreSQL status..."

# Try pg_isready from common Homebrew / Postgres.app locations
PG_ISREADY=$(command -v pg_isready \
    || ls /Applications/Postgres.app/Contents/Versions/*/bin/pg_isready 2>/dev/null | tail -1 \
    || ls /opt/homebrew/opt/postgresql*/bin/pg_isready 2>/dev/null | tail -1 \
    || ls /usr/local/opt/postgresql*/bin/pg_isready 2>/dev/null | tail -1)

PG_CTL=$(command -v pg_ctl \
    || ls /Applications/Postgres.app/Contents/Versions/*/bin/pg_ctl 2>/dev/null | tail -1 \
    || ls /opt/homebrew/opt/postgresql*/bin/pg_ctl 2>/dev/null | tail -1 \
    || ls /usr/local/opt/postgresql*/bin/pg_ctl 2>/dev/null | tail -1)

PGDATA="${PGDATA:-$HOME/pgdata}"

if [ -n "$PG_ISREADY" ] && "$PG_ISREADY" -h 127.0.0.1 -p 5433 >/dev/null 2>&1; then
    echo "Database is already running on port 5433."
else
    echo "Database is stopped."

    # Remove stale postmaster.pid if present (crash recovery)
    if [ -f "$PGDATA/postmaster.pid" ]; then
        echo "Recovering database lock file..."
        rm -f "$PGDATA/postmaster.pid"
    fi

    if [ -n "$PG_CTL" ] && [ -d "$PGDATA" ]; then
        echo "Starting custom PostgreSQL server on port 5433..."
        "$PG_CTL" -D "$PGDATA" -o "-p 5433" -l "$PGDATA/logfile.log" start
        sleep 5
    else
        echo "⚠️  WARNING: Could not locate pg_ctl or PGDATA ($PGDATA)."
        echo "   Please start PostgreSQL manually on port 5433 and re-run this script."
    fi
fi
echo ""

# ── [4/6] Start API backend on port 8085 ──
echo "[4/6] Starting API Backend Server on port 8085..."
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

osascript -e "tell application \"Terminal\" to do script \"
    cd '$SCRIPT_DIR' && \\
    export DATABASE_URL='postgresql://postgres:postgres@127.0.0.1:5433/school_report' && \\
    export SESSION_SECRET='78e8117fe38132cc1bb461ed6cf88b316dc9c0785075d4d6f1ed5508488bbe2b7740737bc6f2189c1541b0c311cd28f835dda744afd2a1fa129e89ad3034bf85' && \\
    export PORT=8085 && \\
    export NODE_ENV=development && \\
    export HTTPS=false && \\
    pnpm --filter @workspace/api-server run dev
\"" &
sleep 2
echo ""

# ── [5/6] Start Frontend on port 3000 ──
echo "[5/6] Starting Frontend Server on port 3000..."
osascript -e "tell application \"Terminal\" to do script \"
    cd '$SCRIPT_DIR' && \\
    export PORT=3000 && \\
    export BASE_PATH='/' && \\
    pnpm --filter @workspace/school-report run dev
\"" &
sleep 5
echo ""

# ── [6/6] Open browser ──
echo "[6/6] Launching default web browser to the login page..."
open http://localhost:3000
echo ""

echo "=========================================================="
echo "      SYSTEM IS RUNNING SEAMLESSLY ON YOUR NETWORK"
echo "=========================================================="
echo ""
echo "  * Local access URL:"
echo "    http://localhost:3000"
echo ""
echo "  * School Network (LAN) access URL:"
echo "    http://$LOCAL_IP:3000"
echo ""
echo "  * Share the School Network URL with teachers and"
echo "    admins connected to the same school Wi-Fi."
echo ""
echo "  * Keep this terminal open during school hours."
echo "    Press Ctrl+C to shut down this launcher window."
echo "    (API and Frontend run in their own Terminal windows)"
echo ""
echo "=========================================================="
echo ""

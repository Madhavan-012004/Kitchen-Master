#!/data/data/com.termux/files/usr/bin/bash
# =====================================================================
#  PROBLOOM ANDROID SERVER - CLEAN INSTALL
#  
#  HOW TO USE (fresh install):
#  1. Open Termux
#  2. Run: termux-setup-storage   (tap Allow)
#  3. Run: bash /sdcard/Download/PROBLOOM_SETUP.sh
#
#  LOGIN AFTER SETUP:
#  Email:    admin@probloom.com
#  Password: ProBloom@2025!
# =====================================================================

INSTALL_DIR="$HOME/probloom"
PG_DATA="$HOME/probloom-pgdata"
PID_FILE="$INSTALL_DIR/server.pid"
LOG="$INSTALL_DIR/server.log"
JAR_DEST="$INSTALL_DIR/probloom-backend.jar"

# Port 48182 — must match the Android APK exactly
SERVER_PORT=48182
DB_NAME=postgres

echo ""; echo "====================================================="
echo "  ProBloom Android Server — Clean Install"; echo "====================================================="

# ─── 1. Storage permission ────────────────────────────────
echo ""; echo "[1/6] Requesting storage access..."
termux-setup-storage
sleep 2
mkdir -p "$INSTALL_DIR"

# ─── 2. Install Java 17 ───────────────────────────────────
echo ""; echo "[2/6] Installing Java 17..."
pkg update -y -q 2>/dev/null
if ! command -v java &>/dev/null; then
    pkg install openjdk-17 -y -q
fi
echo "      $(java -version 2>&1 | head -1)"

# ─── 3. Install PostgreSQL ────────────────────────────────
echo ""; echo "[3/6] Installing PostgreSQL..."
if ! command -v initdb &>/dev/null; then
    pkg install postgresql -y -q
fi
echo "      $(psql --version)"

# ─── 4. Initialize Database ───────────────────────────────
echo ""; echo "[4/6] Setting up database..."
if [ ! -d "$PG_DATA" ]; then
    initdb -D "$PG_DATA" -U postgres -A trust -E UTF8 --no-instructions 2>/dev/null
    echo "port = 5432"                    >> "$PG_DATA/postgresql.conf"
    echo "listen_addresses = '127.0.0.1'" >> "$PG_DATA/postgresql.conf"
    echo "      Database cluster created."
else
    echo "      Database already exists."
fi

pg_ctl -D "$PG_DATA" -l "$INSTALL_DIR/postgres.log" start 2>/dev/null || true
sleep 3
echo "      PostgreSQL running."

# ─── 5. Find and Copy JAR ─────────────────────────────────
echo ""; echo "[5/6] Locating server file..."
JAR_SRC=""
for P in \
    "/sdcard/Download/probloom-backend.jar" \
    "$HOME/storage/downloads/probloom-backend.jar" \
    "/storage/emulated/0/Download/probloom-backend.jar"
do
    if [ -f "$P" ]; then JAR_SRC="$P"; break; fi
done

if [ -z "$JAR_SRC" ]; then
    echo ""; echo "!! ERROR: probloom-backend.jar not found in Downloads !!"
    echo "   Copy it to your Downloads folder and run this script again."
    exit 1
fi

cp "$JAR_SRC" "$JAR_DEST"
echo "      Server file ready ($(du -sh $JAR_DEST | cut -f1))."

# ─── 6. Start Server ──────────────────────────────────────
echo ""; echo "[6/6] Starting backend server on port $SERVER_PORT..."
[ -f "$PID_FILE" ] && kill $(cat "$PID_FILE") 2>/dev/null; rm -f "$PID_FILE"

nohup java -Xmx512m \
    -Dspring.profiles.active=standalone \
    -Dserver.port=$SERVER_PORT \
    -Dserver.address=0.0.0.0 \
    -Dspring.datasource.url=jdbc:postgresql://127.0.0.1:5432/$DB_NAME \
    -Dspring.datasource.username=postgres \
    -Dspring.datasource.password= \
    -Dspring.jpa.hibernate.ddl-auto=update \
    -Dlogging.level.com.probloom=INFO \
    -jar "$JAR_DEST" >> "$LOG" 2>&1 &

echo $! > "$PID_FILE"

# ─── Write Start/Stop shortcuts ───────────────────────────
cat > "$INSTALL_DIR/start.sh" << STARTEOF
#!/data/data/com.termux/files/usr/bin/bash
D="\$HOME/probloom"; PG="\$HOME/probloom-pgdata"
pg_ctl -D "\$PG" -l "\$D/postgres.log" start 2>/dev/null || true
sleep 2
[ -f "\$D/server.pid" ] && kill \$(cat "\$D/server.pid") 2>/dev/null; rm -f "\$D/server.pid"
nohup java -Xmx512m \\
    -Dspring.profiles.active=standalone \\
    -Dserver.port=48182 -Dserver.address=0.0.0.0 \\
    -Dspring.datasource.url=jdbc:postgresql://127.0.0.1:5432/postgres \\
    -Dspring.datasource.username=postgres -Dspring.datasource.password= \\
    -Dspring.jpa.hibernate.ddl-auto=update \\
    -jar "\$D/probloom-backend.jar" >> "\$D/server.log" 2>&1 &
echo \$! > "\$D/server.pid"
echo "ProBloom started on port 48182 (PID: \$(cat \$D/server.pid))"
STARTEOF

cat > "$INSTALL_DIR/stop.sh" << STOPEOF
#!/data/data/com.termux/files/usr/bin/bash
D="\$HOME/probloom"; PG="\$HOME/probloom-pgdata"
[ -f "\$D/server.pid" ] && kill \$(cat "\$D/server.pid") 2>/dev/null && echo "Backend stopped."
rm -f "\$D/server.pid"
pg_ctl -D "\$PG" stop -m fast 2>/dev/null && echo "Database stopped."
STOPEOF

chmod +x "$INSTALL_DIR/start.sh" "$INSTALL_DIR/stop.sh"

# ─── Also add to Termux widget ────────────────────────────
mkdir -p "$HOME/.shortcuts"
cp "$INSTALL_DIR/start.sh" "$HOME/.shortcuts/START ProBloom.sh"
cp "$INSTALL_DIR/stop.sh"  "$HOME/.shortcuts/STOP ProBloom.sh"
chmod +x "$HOME/.shortcuts/START ProBloom.sh" "$HOME/.shortcuts/STOP ProBloom.sh"

echo ""; echo "====================================================="
echo "  Server is starting in background..."
echo "  Wait 3-4 minutes for Java to fully boot, then:"
echo ""
echo "  Open ProBloom APK and you will be able to log in instantly."
echo "  Login with:"
echo "  Email:    admin@probloom.com"
echo "  Password: ProBloom@2025!"
echo "====================================================="
echo ""
echo "  To check if server is ready:"
echo "  grep 'Started\|Admin created\|ERROR' ~/probloom/server.log | tail -5"
echo "====================================================="

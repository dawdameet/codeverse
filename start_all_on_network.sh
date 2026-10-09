#!/usr/bin/env bash
# Start the whole Codeverse stack (judging backend + participant website) so every device on the
# same Wi-Fi / LAN can reach it. Works from any directory.
#
#   ./start_all_on_network.sh                   # start both, print the addresses to share
#   ./start_all_on_network.sh --restart --rebuild   # stop any old servers on the two ports, rebuild, start (use this)
#   ./start_all_on_network.sh --rebuild         # force a fresh website build first (after code changes)
#   ./start_all_on_network.sh --workers 4       # judge workers (default 3)
#   ./start_all_on_network.sh --admin-local-only  # admin panel only usable on this laptop
#
# Participants only ever need  http://<this-laptop-ip>:3000  (the website forwards /api to the backend).
# Press Ctrl+C in this terminal to stop both servers.
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_PORT="${CODEVERSE_PORT:-8080}"
WEB_PORT="${PORT:-3000}"
WORKERS="${CODEVERSE_WORKERS:-3}"
REBUILD=""
RESTART=0

while [ $# -gt 0 ]; do
  case "$1" in
    --rebuild) REBUILD="--rebuild" ;;
    --restart) RESTART=1 ;;
    --workers) shift; WORKERS="${1:?--workers needs a number}" ;;
    --admin-local-only) export CODEVERSE_ADMIN_LOCAL_ONLY=1 ;;
    -h|--help) sed -n '2,13p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "unknown option: $1 (try --help)" >&2; exit 2 ;;
  esac
  shift
done

# --- this laptop's address on the network ---------------------------------------------
lan_ip() {
  local ip=""
  if command -v ipconfig >/dev/null 2>&1; then          # macOS
    for ifc in en0 en1 en2 en3; do
      ip="$(ipconfig getifaddr "$ifc" 2>/dev/null || true)"; [ -n "$ip" ] && break
    done
  fi
  if [ -z "$ip" ] && command -v hostname >/dev/null 2>&1; then   # Linux
    ip="$(hostname -I 2>/dev/null | awk '{print $1}')"
  fi
  if [ -z "$ip" ]; then                                  # last resort: the address used to reach the internet
    ip="$(python3 -c 'import socket;s=socket.socket(socket.AF_INET,socket.SOCK_DGRAM);s.connect(("10.255.255.255",1));print(s.getsockname()[0])' 2>/dev/null || true)"
  fi
  echo "$ip"
}

port_busy() { (command -v lsof >/dev/null 2>&1 && lsof -nP -iTCP:"$1" -sTCP:LISTEN >/dev/null 2>&1); }

if [ "$RESTART" = "1" ]; then
  echo ">> --restart: stopping whatever is listening on ports $BACKEND_PORT and $WEB_PORT"
  for p in "$BACKEND_PORT" "$WEB_PORT"; do
    command -v lsof >/dev/null 2>&1 && lsof -tiTCP:"$p" -sTCP:LISTEN 2>/dev/null | xargs kill 2>/dev/null
  done
  for _ in 1 2 3 4 5 6 7 8 9 10; do
    port_busy "$BACKEND_PORT" || port_busy "$WEB_PORT" || break
    sleep 1
  done
fi

for p in "$BACKEND_PORT" "$WEB_PORT"; do
  if port_busy "$p"; then
    echo "error: port $p is already in use - another Codeverse server is probably running." >&2
    echo "       see what: lsof -nP -iTCP:$p -sTCP:LISTEN     stop it (or run with --restart), then run this again." >&2
    exit 1
  fi
done

LOG_DIR="$ROOT/backend/data"
mkdir -p "$LOG_DIR"
BACKEND_LOG="$LOG_DIR/start_all_backend.log"
WEB_LOG="$LOG_DIR/start_all_website.log"

PIDS=()
cleanup() {
  trap - INT TERM EXIT
  echo
  echo ">> stopping servers..."
  for pid in "${PIDS[@]:-}"; do
    [ -n "$pid" ] && kill "$pid" 2>/dev/null
  done
  # the run scripts exec python/node, but be sure nothing is left on our ports
  sleep 1
  for p in "$BACKEND_PORT" "$WEB_PORT"; do
    command -v lsof >/dev/null 2>&1 && lsof -tiTCP:"$p" -sTCP:LISTEN 2>/dev/null | xargs kill 2>/dev/null
  done
  echo ">> stopped."
  exit 0
}
trap cleanup INT TERM EXIT

# --- backend --------------------------------------------------------------------------
echo ">> starting backend on 0.0.0.0:$BACKEND_PORT ($WORKERS judge workers)"
CODEVERSE_WORKERS="$WORKERS" CODEVERSE_PORT="$BACKEND_PORT" "$ROOT/run_backend.sh" >"$BACKEND_LOG" 2>&1 &
PIDS+=($!)

for _ in $(seq 1 60); do
  curl -fs "http://127.0.0.1:$BACKEND_PORT/api/health" >/dev/null 2>&1 && break
  if ! kill -0 "${PIDS[0]}" 2>/dev/null; then
    echo "error: the backend stopped. Last lines of $BACKEND_LOG:" >&2; tail -15 "$BACKEND_LOG" >&2; exit 1
  fi
  sleep 1
done
curl -fs "http://127.0.0.1:$BACKEND_PORT/api/health" >/dev/null 2>&1 || { echo "error: backend did not come up (see $BACKEND_LOG)" >&2; exit 1; }
echo "   backend is up"

# --- website --------------------------------------------------------------------------
echo ">> starting website on 0.0.0.0:$WEB_PORT (first run or --rebuild builds it: about a minute)"
CODEVERSE_BACKEND_URL="http://127.0.0.1:$BACKEND_PORT" PORT="$WEB_PORT" "$ROOT/run_frontend.sh" $REBUILD >"$WEB_LOG" 2>&1 &
PIDS+=($!)

for _ in $(seq 1 240); do
  curl -fs "http://127.0.0.1:$WEB_PORT/api/health" >/dev/null 2>&1 && break
  if ! kill -0 "${PIDS[1]}" 2>/dev/null; then
    echo "error: the website stopped. Last lines of $WEB_LOG:" >&2; tail -20 "$WEB_LOG" >&2; exit 1
  fi
  sleep 1
done
curl -fs "http://127.0.0.1:$WEB_PORT/api/health" >/dev/null 2>&1 || { echo "error: website did not come up (see $WEB_LOG)" >&2; exit 1; }

# --- summary --------------------------------------------------------------------------
IP="$(lan_ip)"
TOKEN="${CODEVERSE_ADMIN_TOKEN:-$(cat "$ROOT/backend/data/admin_token.txt" 2>/dev/null || echo '(run: cd backend && python3 -m codeverse_server admin token)')}"
HOST="${IP:-<this-laptop-ip>}"
cat <<EOF

=====================================================================
 CODEVERSE IS RUNNING
=====================================================================
 Participants (website)   http://$HOST:$WEB_PORT
 Participants (CLI)       python3 cli/codeverse.py login --server $HOST:$WEB_PORT --team <ID> --code <CODE>
 Admin panel (organizer)  http://$HOST:$BACKEND_PORT/admin      (this laptop: http://localhost:$BACKEND_PORT/admin)
 Admin token              $TOKEN

 Logs                     $BACKEND_LOG
                          $WEB_LOG
 Stop everything          press Ctrl+C here
=====================================================================
 If other devices cannot open it: they must be on the same Wi-Fi as this laptop, and this
 laptop's firewall must allow incoming connections for ports $WEB_PORT and $BACKEND_PORT
 (macOS: System Settings > Network > Firewall; Windows: allow Python and Node).
EOF

# keep running until Ctrl+C or one of the servers dies
while kill -0 "${PIDS[0]}" 2>/dev/null && kill -0 "${PIDS[1]}" 2>/dev/null; do sleep 2; done
echo "error: one of the servers stopped unexpectedly. See the logs above." >&2
exit 1

#!/usr/bin/env bash
# Start the Codeverse judging server + API. Works from any directory.
#   ./run_backend.sh                 # serve on 0.0.0.0:8080
#   ./run_backend.sh --port 9000 --workers 4
# Environment overrides: CODEVERSE_DATA, CODEVERSE_PORT, CODEVERSE_WORKERS, CODEVERSE_COOLDOWN, ...
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND="$ROOT/backend"
cd "$BACKEND"

PY="${PYTHON:-python3}"
command -v "$PY" >/dev/null || { echo "error: python3 not found" >&2; exit 1; }
command -v git >/dev/null || { echo "error: git is required (used to apply submitted patches)" >&2; exit 1; }

ASSETS="${CODEVERSE_ASSETS:-$BACKEND/judge_assets}"
if [ ! -f "$ASSETS/test_mapping.json" ]; then
  echo ">> judge assets missing - building them from ../OBELISK"
  "$PY" scripts/prepare_judge_assets.py --out "$ASSETS"
fi

DATA="${CODEVERSE_DATA:-$BACKEND/data}"
TEAMS=$("$PY" - <<PYEOF 2>/dev/null || echo 0
import sqlite3, os
p = os.path.join(r"$DATA", "codeverse.db")
print(sqlite3.connect(p).execute("select count(*) from teams").fetchone()[0] if os.path.exists(p) else 0)
PYEOF
)
if [ "$TEAMS" = "0" ]; then
  echo ">> no teams yet. In another terminal (from anywhere):"
  echo "     cd $BACKEND && python3 -m codeverse_server admin make-teams --count 30 --out teams.csv"
  echo "     python3 -m codeverse_server admin import-teams teams.csv"
  echo "     python3 -m codeverse_server admin start --phase1-minutes 180"
fi

echo ">> backend data: $DATA"
exec "$PY" -m codeverse_server serve "$@"

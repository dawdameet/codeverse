#!/usr/bin/env bash
# Build (if needed) and serve the Codeverse website on port 3000. Works from any directory.
#   ./run_frontend.sh                # build if needed, then serve on :3000
#   ./run_frontend.sh --rebuild      # force a rebuild first
#   PORT=8000 ./run_frontend.sh
#   ./run_frontend.sh --mock         # website only, built-in mock data (no backend needed)
# The website proxies /api to the backend (CODEVERSE_BACKEND_URL, default http://127.0.0.1:8080).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT/frontend"

command -v node >/dev/null || { echo "error: node is not installed" >&2; exit 1; }
if [ ! -d node_modules ]; then
  echo ">> installing dependencies (needs internet once)"
  npm install
fi

MODE=http
REBUILD=0
for arg in "$@"; do
  case "$arg" in
    --rebuild) REBUILD=1 ;;
    --mock) MODE=mock; REBUILD=1 ;;
    *) echo "unknown option: $arg" >&2; exit 2 ;;
  esac
done

# The API mode is baked in at build time, so a change of mode forces a rebuild.
WANT="NEXT_PUBLIC_CODEVERSE_API=$MODE"
if [ ! -f .env.local ] || ! grep -qx "$WANT" .env.local; then
  echo "$WANT" > .env.local
  REBUILD=1
fi
[ -f .next/BUILD_ID ] || REBUILD=1

# The proxy target (/api -> backend) is also fixed at build time.
BACKEND_URL="${CODEVERSE_BACKEND_URL:-http://127.0.0.1:8080}"
export CODEVERSE_BACKEND_URL="$BACKEND_URL"
[ "$(cat .next/.backend_url 2>/dev/null || true)" = "$BACKEND_URL" ] || REBUILD=1

if [ "$REBUILD" = "1" ]; then
  echo ">> building ($MODE mode)"
  npx next build
  echo "$BACKEND_URL" > .next/.backend_url
fi

PORT="${PORT:-3000}"
echo ">> website on http://0.0.0.0:$PORT  (api mode: $MODE, backend: $BACKEND_URL)"
exec npx next start -H 0.0.0.0 -p "$PORT"

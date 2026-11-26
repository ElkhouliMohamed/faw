#!/usr/bin/env bash
set -euo pipefail
SHOP=/workspace/faw-shop
API=/workspace/faw-api
TMP=$(mktemp -d /tmp/faw-http.XXXXXX)
cleanup() {
  for f in "$TMP/api.pid" "$TMP/next.pid"; do
    if [[ -f "$f" ]]; then kill -- "-$(<"$f")" 2>/dev/null || true; fi
  done
}
trap cleanup EXIT
if fuser -n tcp 3101 8001 >/dev/null 2>&1; then echo 'Test ports 3101/8001 must be free.' >&2; exit 1; fi
export APP_ENV=testing DB_DATABASE="$TMP/test.sqlite" CACHE_PREFIX="faw-http-$(basename "$TMP")"
export RESEND_API_KEY='' QUOTE_EMAIL_FROM=''
# Test code must never reserve a real quote number, write the real journal, or send email.
export DEVIS_COUNTER_SCRIPT="$TMP/counter-not-configured.py" DEVIS_JOURNAL_PATH="$TMP/journal-not-configured.csv"
export DEVIS_GENERATOR_SCRIPT="$TMP/generator-not-configured.py" DEVIS_OUTPUT_DIR="$TMP/out"
cd "$API"
php artisan migrate --force --no-interaction > "$TMP/migrate.log" 2>&1
php artisan faw:test-fixture
setsid -f sh -c 'echo $$ > "$1/api.pid"; cd /workspace/faw-api; exec php artisan serve --host=127.0.0.1 --port=8001 > "$1/api.log" 2>&1' sh "$TMP"
setsid -f sh -c 'echo $$ > "$1/next.pid"; cd /workspace/faw-shop; LARAVEL_ORIGIN=http://127.0.0.1:8001 LARAVEL_DATABASE_URL="file:$1/test.sqlite" exec node node_modules/next/dist/bin/next start -p 3101 > "$1/next.log" 2>&1' sh "$TMP"
node - <<'JS'
(async()=>{for(let i=0;i<40;i++){try{const a=await fetch('http://127.0.0.1:8001/api/catalog');const b=await fetch('http://127.0.0.1:3101/');await a.arrayBuffer();await b.arrayBuffer();if(a.ok&&b.ok)return;}catch{}await new Promise(r=>setTimeout(r,250));}throw Error('Test servers failed to start');})();
JS
cd "$SHOP"
node scripts/http-integration.mjs
printf 'Isolated logs: %s\n' "$TMP"

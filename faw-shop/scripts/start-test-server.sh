#!/usr/bin/env bash
# Serveur de test v4 sur :3200 : copie isolée du générateur (/tmp/faw-devis-test), base de test séparée.
# E-mail : API Resend simulée sur 127.0.0.1:3299 (serveur fictif lancé par scripts/e2e.mjs), jamais l'API réelle.
# Ne touche ni au compteur ni au journal réels, ni à la base de production.
set -euo pipefail
cd "$(dirname "$0")/.."
PORT="${PORT:-3200}"
node scripts/setup-devis-test.mjs >/dev/null
cp prisma/faw.db /tmp/faw-devis-test/faw-test.db
# next renomme son processus en « next-server » : on cible le PID qui écoute sur le port (jamais :3100).
for pid in $(ss -ltnpH "sport = :${PORT}" | grep -o 'pid=[0-9]*' | cut -d= -f2 | sort -u); do kill "$pid" 2>/dev/null || true; done
sleep 1
setsid -f bash -c "cd '$PWD' && set -a && . ./.env.local && set +a && \
  export DATABASE_URL=file:/tmp/faw-devis-test/faw-test.db FAW_TEST=1 PYTHON_BIN=/usr/bin/python3 \
  DEVIS_GENERATOR_SCRIPT=/tmp/faw-devis-test/devis/generer_devis.py DEVIS_COUNTER_SCRIPT=/tmp/faw-devis-test/devis/prochain_numero.py \
  DEVIS_JOURNAL_PATH=/tmp/faw-devis-test/devis/journal-devis.csv DEVIS_OUTPUT_DIR=/tmp/faw-devis-test/out UPLOAD_DIR=/tmp/faw-devis-test/uploads REDIRECTS_FILE=/tmp/faw-devis-test/redirects.json REDIRECT_HITS_FILE=/tmp/faw-devis-test/redirect-hits.json \
  NEXT_PUBLIC_NOINDEX=${TEST_NOINDEX:-1} FORM_RATE_LIMIT=200 FORM_MIN_FILL_MS=800 ADMIN_MAX_FAILS=5 ADMIN_LOCK_MINUTES=1 \
  RESEND_API_KEY=re_test_dummy QUOTE_EMAIL_FROM='FAW Test <devis@example.test>' QUOTE_EMAIL_REPLY_TO=faw@faw.ma QUOTE_EMAIL_BCC= \
  RESEND_API_BASE_URL=http://127.0.0.1:3299 QUOTE_PUBLIC_BASE_URL= QUOTE_LINK_RATE_LIMIT=80 QUOTE_EMAIL_RESEND_MIN_SECONDS=4 && \
  exec node node_modules/next/dist/bin/next start -p ${PORT} -H 127.0.0.1 > /tmp/faw-devis-test/server-test.log 2>&1"
for i in $(seq 1 40); do curl -fsS -o /dev/null "http://127.0.0.1:${PORT}/" && { echo "test server up on :${PORT}"; exit 0; }; sleep 0.5; done
echo "server failed to start"; tail -20 /tmp/faw-devis-test/server-test.log; exit 1

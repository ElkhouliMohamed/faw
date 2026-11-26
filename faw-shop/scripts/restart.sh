#!/usr/bin/env bash
# Rebuild + relance le serveur de production en arrière-plan (port 3100).
set -euo pipefail
cd "$(dirname "$0")/.."
npm run build
if [ -f .server.pid ] && kill -0 "$(cat .server.pid)" 2>/dev/null; then kill "$(cat .server.pid)"; sleep 1; fi
for pid in $(ss -ltnpH "sport = :3100" | grep -o "pid=[0-9]*" | cut -d= -f2 | sort -u); do kill "$pid" 2>/dev/null || true; done
sleep 1
nohup node node_modules/next/dist/bin/next start -p 3100 -H 0.0.0.0 > server.log 2>&1 &
echo $! > .server.pid
sleep 3
curl -s -o /dev/null -w "local %{http_code}\n" http://localhost:3100/

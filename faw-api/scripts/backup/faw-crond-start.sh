#!/bin/bash
# Starts busybox crond (as root; jobs run as user "box" from /workspace/backups/crontabs/box). Idempotent.
# Not a Grok routine. Re-run after a box restart. Source of truth: /workspace/backups/crontab.txt
set -euo pipefail
# busybox crond only reads root-owned crontab files
sudo install -o root -g root -m 600 /workspace/backups/crontab.txt /workspace/backups/crontabs/box
sudo touch /workspace/backups/crontabs
PAT='busybox crond -b -c /workspace/backups/crontabs'
if pgrep -f "$PAT" >/dev/null; then echo "crond déjà actif"; exit 0; fi
sudo /home/box/.local/bin/busybox crond -b -c /workspace/backups/crontabs -L /workspace/backups/logs/crond.log -l 8
sleep 1; pgrep -af "$PAT" >/dev/null && echo "crond démarré"

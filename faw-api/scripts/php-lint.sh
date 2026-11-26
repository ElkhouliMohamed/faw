#!/usr/bin/env bash
# Vérifie la syntaxe PHP des sources du projet (hors vendor).
set -euo pipefail
cd "$(cd "$(dirname "$0")/.." && git rev-parse --show-toplevel)"
fail=0
count=0
while IFS= read -r f; do
  count=$((count + 1))
  if ! php -l "$f" >/dev/null; then
    echo "Syntaxe invalide : $f" >&2
    fail=1
  fi
done < <(git ls-files '*.php')
if [ "$fail" -ne 0 ]; then
  exit 1
fi
echo "php -l : OK ($count fichiers)"

#!/bin/bash
# Weekly integrity check of the most recent FAW backup (read-only). Exit code 1 on any failure.
set -uo pipefail
export PATH=$HOME/.local/bin:$PATH
ROOT=${FAW_BACKUP_ROOT:-/workspace/backups}
B=${1:-$(ls -1d "$ROOT"/faw-[0-9]*-[0-9]* 2>/dev/null | sort -r | head -1)}
LOG=$ROOT/logs/verify-$(date +%Y%m%d).log
mkdir -p "$ROOT/logs"
fail=0
{
  echo "== $(date '+%F %T %Z') vérification de $B"
  [ -d "$B" ] || { echo "ERREUR: aucune sauvegarde"; exit 1; }
  (cd "$B" && sha256sum -c --quiet SHA256SUMS) && echo "manifeste: OK" || { echo "manifeste: ERREUR"; fail=1; }
  for db in "$B"/db/*; do
    r=$(sqlite3 "$db" 'PRAGMA integrity_check;' 2>&1); [ "$r" = ok ] && echo "$(basename "$db"): integrity ok" || { echo "$(basename "$db"): ERREUR $r"; fail=1; }
  done
  vr=$(mktemp -d); git init -q "$vr"  # git bundle verify needs a repository (bundles are complete histories)
  for bd in "$B"/git/*.bundle; do git -C "$vr" bundle verify -q "$bd" >/dev/null 2>&1 && echo "$(basename "$bd"): ok" || { echo "$(basename "$bd"): ERREUR"; fail=1; }; done; rm -rf "$vr"
  for t in "$B"/files/*.tgz; do tar -tzf "$t" >/dev/null 2>&1 && echo "$(basename "$t"): lisible" || { echo "$(basename "$t"): ERREUR"; fail=1; }; done
  tar -tf "$B/env/env-files.tar" >/dev/null 2>&1 && echo "env-files.tar: lisible" || { echo "env-files.tar: ERREUR"; fail=1; }
  tar -tzf "$B/files/meta-closer-produits.tgz" | grep -c 'produits/produits-reference.csv$' >/dev/null && echo "produits-reference.csv: présent" || { echo "produits-reference.csv: ABSENT"; fail=1; }
  [ "$(stat -c %a "$B")" = 700 ] && echo "droits dossier: 700" || { echo "droits dossier: ERREUR"; fail=1; }
  echo "== résultat: $([ $fail = 0 ] && echo OK || echo ÉCHEC)"
} >> "$LOG" 2>&1
tail -1 "$LOG"
exit $fail

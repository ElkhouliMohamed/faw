#!/bin/bash
# Daily FAW backup: run faw-backup.sh, verify the manifest, keep the 14 most recent backups.
set -uo pipefail
umask 077
ROOT=${FAW_BACKUP_ROOT:-/workspace/backups}
KEEP=${FAW_BACKUP_KEEP:-14}
LOG=$ROOT/logs/backup-$(date +%Y%m%d).log
mkdir -p "$ROOT/logs"; chmod 700 "$ROOT" "$ROOT/logs"
{
  echo "== $(date '+%F %T %Z') backup start"
  B=$(bash "$ROOT/faw-backup.sh" | tail -1) || { echo "ERREUR: faw-backup.sh a échoué"; exit 1; }
  [ -d "$B" ] || { echo "ERREUR: dossier de sauvegarde absent"; exit 1; }
  (cd "$B" && sha256sum -c --quiet SHA256SUMS) || { echo "ERREUR: manifeste invalide pour $B"; exit 1; }
  tar -tzf "$B/files/meta-closer-produits.tgz" | grep -c 'produits/produits-reference.csv$' >/dev/null || { echo "ERREUR: produits-reference.csv absent de $B"; exit 1; }
  echo "OK $B"
  # rotation: only directories named faw-YYYYMMDD-HHMMSS, newest first; never touches anything else
  ls -1d "$ROOT"/faw-[0-9]*-[0-9]* 2>/dev/null | sort -r | tail -n +$((KEEP + 1)) | while read -r old; do
    rm -rf -- "$old" && echo "rotation: supprimé $old"
  done
  echo "== $(date '+%F %T %Z') backup end"
} >> "$LOG" 2>&1

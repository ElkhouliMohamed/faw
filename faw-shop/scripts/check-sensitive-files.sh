#!/usr/bin/env bash
# Échoue si le dépôt suit des fichiers qui ne doivent jamais être publiés.
set -euo pipefail
cd "$(cd "$(dirname "$0")/.." && git rev-parse --show-toplevel)"

allow_sql() {
  case "$1" in
    database/legacy-schema.sql) return 0 ;;
    *) return 1 ;;
  esac
}

allow_pdf() {
  case "$1" in
    resources/documents/*) return 0 ;;
    public/images/docs/*) return 0 ;;
    *) return 1 ;;
  esac
}

fail=0
issues=()

while IFS= read -r f; do
  [ -z "$f" ] && continue
  base="$(basename "$f")"
  lower="$(printf '%s' "$f" | tr '[:upper:]' '[:lower:]')"

  if [[ "$base" == ".env" || "$base" == .env.* ]]; then
    if [[ "$base" != ".env.example" ]]; then
      issues+=("fichier d'environnement suivi : $f")
      fail=1
    fi
    continue
  fi

  if [[ "$lower" == *.sqlite || "$lower" == *.sqlite3 || "$lower" == *.db || "$lower" == *.db-journal ]]; then
    issues+=("base de données suivie : $f")
    fail=1
    continue
  fi

  if [[ "$lower" == *.sql ]]; then
    if ! allow_sql "$f"; then
      issues+=("fichier SQL suivi (dump ou hors exception) : $f")
      fail=1
    fi
    continue
  fi

  if [[ "$lower" == *.log ]]; then
    issues+=("journal suivi : $f")
    fail=1
    continue
  fi

  if [[ "$lower" == *.pdf ]]; then
    if [[ "$lower" == *devis* || "$lower" == data/devis/* || "$lower" == storage/app/private/* ]]; then
      if ! allow_pdf "$f"; then
        issues+=("PDF de devis ou document privé suivi : $f")
        fail=1
      fi
    fi
    continue
  fi

  if [[ "$lower" == *journal-devis.csv ]]; then
    issues+=("journal des devis suivi : $f")
    fail=1
  fi
done < <(git ls-files)

if [ "$fail" -ne 0 ]; then
  echo "Contrôle des fichiers sensibles : ÉCHEC" >&2
  printf '  - %s\n' "${issues[@]}" >&2
  exit 1
fi

echo "Contrôle des fichiers sensibles : OK ($(git ls-files | wc -l) fichiers suivis)"

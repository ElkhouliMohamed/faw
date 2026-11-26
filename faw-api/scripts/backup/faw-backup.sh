#!/bin/bash
set -euo pipefail
umask 077
export PATH=$HOME/.local/bin:$PATH
TS=$(date +%Y%m%d-%H%M%S); DATE=$(date +%Y%m%d)
B=/workspace/backups/faw-$TS
mkdir -p $B/{git,db,files,meta,env}; chmod 700 /workspace/backups $B
TAG=faw-pre-audit-backup-$DATE
for r in faw-shop faw-api; do
  cd /workspace/$r
  { echo "repo=$r"; echo "branch=$(git branch --show-current)"; echo "HEAD=$(git rev-parse HEAD)"; git for-each-ref --format='%(refname) %(objectname)' refs/heads refs/tags; echo "--- status"; git status --porcelain=v1; echo "--- stash"; git stash list; } > $B/meta/$r-git-state.txt
  git rev-parse -q --verify refs/tags/$TAG >/dev/null || git tag -a $TAG -m "Checkpoint avant audit phase 1 ($TS)" HEAD
  git bundle create $B/git/$r-all.bundle --all 2>/dev/null
  git bundle verify $B/git/$r-all.bundle > $B/meta/$r-bundle-verify.txt 2>&1
  git diff HEAD > $B/git/$r-uncommitted.diff || true
done
cd /workspace
sqlite3 faw-api/database/database.sqlite ".backup '$B/db/faw-api-database.sqlite'"
sqlite3 faw-shop/prisma/faw.db ".backup '$B/db/faw-shop-prisma-faw.db'"
sqlite3 faw-shop/prisma/faw-backup-v3.db ".backup '$B/db/faw-shop-prisma-faw-backup-v3.db'"
for f in $B/db/*; do sqlite3 "$f" .schema > $B/meta/$(basename $f).schema.sql; done
tar -czf $B/files/faw-api-storage-app.tgz -C /workspace faw-api/storage/app
tar -czf $B/files/faw-shop-public.tgz -C /workspace --exclude=faw-shop/public/storage faw-shop/public
tar -czf $B/files/faw-shop-data.tgz -C /workspace faw-shop/data
tar -czf $B/files/faw-api-public-assets.tgz -C /workspace --exclude=faw-api/public/storage faw-api/public
tar -czf $B/files/meta-closer-devis.tgz -C /workspace meta-closer/devis
tar -czf $B/files/meta-closer-produits.tgz -C /workspace meta-closer/produits
tar -cf $B/env/env-files.tar -C /workspace faw-api/.env faw-shop/.env.local; chmod 600 $B/env/env-files.tar
(cd faw-api && php artisan migrate:status --no-ansi) > $B/meta/faw-api-migrate-status.txt 2>&1
{ uname -a; php -v | head -1; node -v; npm -v; sqlite3 --version; } > $B/meta/environment.txt
find $B -type f | xargs chmod 600
find $B -type d | xargs chmod 700
(cd $B && find . -type f ! -name SHA256SUMS -print0 | sort -z | xargs -0 sha256sum > SHA256SUMS); chmod 600 $B/SHA256SUMS
echo $B

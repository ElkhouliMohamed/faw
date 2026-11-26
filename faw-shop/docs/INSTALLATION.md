# Installation — faw-shop

Vitrine Next.js 15 (App Router, TypeScript, Tailwind). L’API Laravel doit être installée à part (voir `faw-api/docs/INSTALLATION.md`).

## Prérequis

Node.js 22 LTS recommandé (18.18+ accepté), npm 10+, l’API accessible pour le catalogue et les devis.

## Première installation

```sh
cd faw-shop
npm ci
cp .env.example .env.local
chmod 600 .env.local
```

Renseigner au minimum `LARAVEL_ORIGIN` (ex. `http://127.0.0.1:8000`). Laisser les secrets vides tant qu’ils n’ont pas été fournis par le propriétaire. Les chemins `DEVIS_*` ne sont nécessaires que si ce poste génère des PDF de devis.

Ne pas lancer `prisma db push` ni de migration Prisma sur la base Laravel.

## Lancer la vitrine

```sh
npm run dev
# écoute typiquement sur http://localhost:3100
```

Pour un build de production local :

```sh
npm run build
npm start -- --port 3100
```

Ne pas occuper le port 3100 s’il sert déjà l’aperçu en cours, et ne pas modifier le watchdog ou ngrok.

## Vérifications

```sh
npm run lint
npx tsc --noEmit
npm run build
bash scripts/check-sensitive-files.sh
```

Les parcours Playwright (`npm run e2e`) sont optionnels, isolés, et ne doivent jamais cibler le vrai journal de devis ni envoyer un e-mail réel.

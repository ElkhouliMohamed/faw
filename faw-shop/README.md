# FAW Aluminium — boutique

Vitrine Next.js 15 de FAW Aluminium (Casablanca). Dépôt **privé** destiné à la même organisation GitHub que l’API. Les pages publiques n’affichent **aucun prix** : le client constitue une demande de devis. Le paiement par carte est désactivé.

L’API et le back-office Filament, ainsi que la documentation d’équipe commune, sont dans le dépôt `faw-api`.

## Pile

- Next.js 15 (App Router) · TypeScript · Tailwind
- L’administration métier, le catalogue et les devis sont servis par Laravel ; ce front relaie `/admin`, `/api`, `/livewire` et les assets Filament.

## Structure

```
src/app/       pages vitrine, relais, actions serveur
src/components composants d’interface
src/lib        accès API, devis, sécurité, contenu
public/        images et identités visuelles
scripts/       outillage local, contrôle des fichiers sensibles
docs/          installation et développement de la vitrine
.github/       CI, modèle de déploiement manuel, CODEOWNERS
```

Les devis PDF, bases locales, journaux et captures restent hors Git.

## Démarrage rapide

```sh
npm ci
cp .env.example .env.local   # seulement sur une installation neuve
chmod 600 .env.local
# Renseigner LARAVEL_ORIGIN (ex. http://127.0.0.1:8000)
npm run dev
```

La vitrine écoute typiquement sur `http://localhost:3100`. L’API Laravel doit tourner en parallèle.

```sh
npm run lint
npx tsc --noEmit
npm run build
bash scripts/check-sensitive-files.sh
```

## Documentation

Dans ce dépôt :

- [Installation](docs/INSTALLATION.md)
- [Développement](docs/DEVELOPMENT.md)
- [Déploiement](docs/DEPLOYMENT.md) (renvoie à la procédure commune)
- [Sécurité](docs/SECURITY.md)

Dans `faw-api` (documentation d’organisation) :

- [Accueil de l’équipe](../faw-api/docs/TEAM_ONBOARDING.md) — chemin local si les deux dépôts sont côte à côte
- [Accès de l’équipe](../faw-api/docs/TEAM_ACCESS.md)
- [Réglages GitHub](../faw-api/docs/GITHUB_SETTINGS.md)
- [Hébergement staging](../faw-api/docs/STAGING_HOSTING.md)
- [Sauvegarde](../faw-api/docs/BACKUP_RESTORE.md)

Variables d’environnement : `.env.example` (secrets vides, pas de chemins d’une autre machine). Notes de design : `DESIGN-NOTES.md`. Mise en route de l’e-mail : `RESEND-SETUP.md`.

## Règles essentielles

- Dépôt privé ; aucun push sans accord du propriétaire.
- Aucun prix sur le site public, l’API publique relaisée, le JSON-LD ou les événements d’analytics.
- Ne pas nommer de fournisseur (exception documentée pour le kit). Comptes individuels, secrets hors Git.

# FAW Aluminium

Dépôt **privé** unique pour la vitrine et le back-office de FAW Aluminium (Casablanca). Les pages et l’API publiques n’affichent **aucun prix** : tout passe par une demande de devis. Le paiement par carte est désactivé.

| Application | Dossier | Pile | Documentation |
|---|---|---|---|
| Vitrine | [`faw-shop/`](./faw-shop/) | Next.js 15, TypeScript, Tailwind | [README](./faw-shop/README.md), [installation](./faw-shop/docs/INSTALLATION.md), [développement](./faw-shop/docs/DEVELOPMENT.md), [déploiement](./faw-shop/docs/DEPLOYMENT.md), [sécurité](./faw-shop/docs/SECURITY.md), [arrivée dans l’équipe](./faw-shop/docs/TEAM_ONBOARDING.md) |
| API et administration | [`faw-api/`](./faw-api/) | Laravel 12, Filament 4 | [README](./faw-api/README.md), [installation](./faw-api/docs/INSTALLATION.md), [développement](./faw-api/docs/DEVELOPMENT.md), [base de données](./faw-api/docs/DATABASE.md), [sauvegardes](./faw-api/docs/BACKUP_RESTORE.md), [déploiement](./faw-api/docs/DEPLOYMENT.md), [sécurité](./faw-api/docs/SECURITY.md), [accès équipe](./faw-api/docs/TEAM_ACCESS.md), [GitHub](./faw-api/docs/GITHUB_SETTINGS.md), [staging](./faw-api/docs/STAGING_HOSTING.md), [arrivée dans l’équipe](./faw-api/docs/TEAM_ONBOARDING.md) |

La documentation d’organisation (accès, GitHub, staging) vit dans `faw-api/docs/`. Les workflows GitHub, CODEOWNERS et Dependabot sont à la racine (`.github/`).

## Démarrage local

Les deux applications tournent ensemble : l’API sur `127.0.0.1:8000`, la vitrine typiquement sur le port 3100, qui relaie `/admin`, `/api`, `/livewire` et les assets Filament.

Voir les README de chaque dossier pour l’installation. Ne jamais commiter un fichier `.env`, une base locale, des journaux ou un PDF de devis.

# Accueil de l’équipe FAW

Document d’accueil pour le développement, la prévisualisation et l’administration de FAW Aluminium. Les accès nominatifs, mots de passe, clés API et jetons se demandent au propriétaire. Ils ne figurent jamais dans ce dépôt.

La documentation d’organisation (accès GitHub, rôles Filament, paramètres du dépôt, hébergement staging) vit dans **ce dépôt `faw-api`**. Le dépôt `faw-shop` contient la documentation propre à la vitrine Next.js et renvoie ici pour les sujets communs.

## Vue d’ensemble du projet

FAW Aluminium (Casablanca) vend notamment des portes coupe-feu, du galandage, du matériel incendie et un kit d’automatisme. Le site public ne montre **aucun prix** : toute demande passe par un devis. Le paiement par carte est désactivé. Il n’y a ni crédit ni échéancier.

Deux dépôts privés, destinés à une organisation GitHub privée au nom de FAW :

| Dépôt | Rôle | Pile |
|---|---|---|
| `faw-shop` | Vitrine Next.js (port local 3100) | Next.js 15, TypeScript, Tailwind |
| `faw-api` | API Laravel et back-office Filament (port local 8000) | Laravel 12, Filament 4, SQLite en local |

Le front relaie `/admin`, `/api`, `/livewire`, `/storage` et les assets Filament vers Laravel. Filament est la seule interface d’administration. L’ancien `/admin` Next n’accorde plus de droits.

## Structure des dépôts

**faw-api :** `app/` (HTTP, modèles, services, ressources Filament), `config/`, `database/` (migrations, seeders), `routes/`, `resources/`, `storage/` (contenu privé non versionné), `tests/`, `docs/`, `.github/`.

**faw-shop :** `src/app/` (pages vitrine), `src/components/`, `src/lib/`, `public/`, `scripts/`, `docs/`, `.github/`. Les devis PDF, bases SQLite, journaux et captures d’écran restent hors Git.

## Logiciels requis

| Outil | Version |
|---|---|
| PHP | 8.2 ou plus (8.4 convenu en aperçu local) |
| Composer | 2.x |
| Node.js | 22 LTS recommandé (18.18+ accepté par Next.js 15) |
| npm | 10+ (fourni avec Node) |
| SQLite | 3.x (développement local) |
| Python 3 | pour les scripts de devis partagés (`generer_devis.py`, `prochain_numero.py`) |

Git est requis. Un compte GitHub **personnel**, avec authentification à deux facteurs, est obligatoire pour l’organisation.

## Configuration de l’environnement

1. Copier `.env.example` vers `.env` (`faw-api`) ou `.env.local` (`faw-shop`).
2. Ne jamais commiter ces fichiers. Permissions recommandées : `chmod 600`.
3. Les secrets (clés, mots de passe, `APP_KEY`, `RESEND_API_KEY`) se demandent au propriétaire ou se génèrent localement (`php artisan key:generate`). Ils restent vides dans les exemples.
4. Les chemins des scripts de devis (`DEVIS_GENERATOR_SCRIPT`, `DEVIS_COUNTER_SCRIPT`, `DEVIS_JOURNAL_PATH`) pointent vers les outils partagés de l’équipe, pas vers un chemin copié d’une autre machine.
5. `LARAVEL_ORIGIN` (shop) vaut typiquement `http://127.0.0.1:8000` en local.

Voir [INSTALLATION.md](./INSTALLATION.md) et le `.env.example` de chaque dépôt.

## Base de données

En local : SQLite, fichier ignoré par Git. Création et migrations : voir [DATABASE.md](./DATABASE.md). En production, un moteur client-serveur (PostgreSQL ou MySQL) est recommandé. Ne jamais utiliser la base de production en développement ou en staging.

## Commandes de développement

Voir [DEVELOPMENT.md](./DEVELOPMENT.md) et, pour la vitrine, `docs/DEVELOPMENT.md` du dépôt `faw-shop`.

Résumé API :

```sh
composer install
php artisan serve --host=127.0.0.1 --port=8000
php artisan test
```

Résumé vitrine (dépôt `faw-shop`) :

```sh
npm ci
npm run dev
# ou, pour un build de production local : npm run build && npm start
```

Ne pas arrêter ni reconfigurer un aperçu déjà en service sans consigne du propriétaire.

## Accès au front-office

- **Production (cible) :** site public sous le domaine officiel FAW, en HTTPS. Adresse exacte à confirmer par le propriétaire.
- **Staging (cible) :** URL de prévisualisation réservée à l’équipe, protégée par un contrôle d’identité individuel (voir [STAGING_HOSTING.md](./STAGING_HOSTING.md)). L’URL n’est pas encore fixée.
- **Aperçu actuel :** tunnel temporaire (ngrok) sur la machine de développement. Ce n’est **pas** le staging officiel : pas d’authentification d’équipe durable, URL instable.
- **Local :** `http://localhost:3100` lorsque les serveurs locaux tournent.

## Accès au back-office et à Filament

- URL typique : `https://<domaine>/admin/login` (en local, via le front qui relaie vers Laravel).
- Comptes **individuels** uniquement. Pas de mot de passe partagé.
- Rôles aujourd’hui dans l’application : `admin` et `viewer` (lecture seule stricte). Les rôles plus fins sont proposés dans [TEAM_ACCESS.md](./TEAM_ACCESS.md) mais **ne sont pas encore implémentés**.
- Un compte se crée uniquement par un administrateur, dans Filament › Utilisateurs. Les identifiants se transmettent par un canal convenu avec le propriétaire, jamais dans Git ni dans une discussion publique.
- Désactiver ou supprimer le compte dès qu’une personne quitte l’équipe.

## URL de staging

À définir après le choix d’hébergement et l’accord du propriétaire. En attendant, ne pas traiter l’aperçu ngrok comme un staging d’équipe.

## Branches Git

| Branche | Rôle |
|---|---|
| `main` | code prêt pour la production |
| `develop` | intégration des développements |
| `staging` | validation préproduction, lorsque l’environnement existe |
| `feature/*` | nouvelle fonctionnalité |
| `fix/*` | correction |
| `hotfix/*` | correctif urgent sur la production |

Le dépôt `faw-shop` utilisait `master` : il a été renommé **localement** en `main`. Lors de la création du dépôt GitHub, définir `main` comme branche par défaut.

Ne jamais pousser directement sur `main`. Voir [DEVELOPMENT.md](./DEVELOPMENT.md).

## Procédure de pull request

1. Créer une branche `feature/…`, `fix/…` ou `hotfix/…` à partir de `develop` (ou de `main` pour un hotfix).
2. Implémenter et tester en local.
3. Ouvrir une pull request vers `develop` (vers `main` pour un hotfix, avec accord).
4. La CI doit passer (qualité, tests, scan de secrets, fichiers sensibles).
5. Au moins une revue est exigée (réglages à activer sur GitHub, voir [GITHUB_SETTINGS.md](./GITHUB_SETTINGS.md)).
6. Fusion seulement après approbation. Pas de `force push` ni de suppression des branches protégées.

## Procédure de déploiement

Décrite dans [DEPLOYMENT.md](./DEPLOYMENT.md) (12 étapes, plan de retour, migrations). Aucun déploiement production sans accord du propriétaire. Aucun secret de production dans le staging ou le développement.

## Règles de sécurité

Voir [SECURITY.md](./SECURITY.md). Points non négociables :

- dépôts privés ; pas de publication du code sans autorisation ;
- aucun secret dans Git, le chat ou les captures ;
- 2FA obligatoire sur les comptes GitHub de l’organisation ;
- nettoyage d’historique uniquement avec l’accord du propriétaire ;
- pas de prix sur le site public ; pas de noms de fournisseurs (exception documentée pour le kit) ;
- comptes individuels, principe du moindre privilège.

## Sauvegarde et restauration

Voir [BACKUP_RESTORE.md](./BACKUP_RESTORE.md). Une restauration de production se décide avec le propriétaire et un plan écrit.

## Contact et escalade

- **Propriétaire :** Walfar (FAW Aluminium). C’est lui qui ouvre les accès, approuve les déploiements production et les achats d’hébergement.
- **Escalade technique ou sécurité** (secret exposé, incident, doute sur une migration) : d’abord le propriétaire, puis les membres de l’équipe GitHub « FAW Owners » une fois l’organisation créée.
- Les coordonnées personnelles et professionnelles se demandent au propriétaire ; elles ne sont pas recopiées ici.

Aucun mot de passe, aucune clé API et aucun jeton ne doivent être ajoutés à ce document.

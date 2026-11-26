# Base de données — faw-api

## Local

- Moteur : SQLite.
- Fichier typique : `database/database.sqlite` (ignoré par Git, de même que `*.sqlite*`).
- Schéma suivi dans `database/migrations/` et, pour référence historique, `database/legacy-schema.sql` (schéma uniquement, pas un dump de données clients).
- Commandes : `php artisan migrate`, `php artisan migrate:status`, `php artisan db:seed --class=ShopDefaultsSeeder`.

Le seeder de boutique crée les catégories de base et les paramètres généraux (coordonnées professionnelles). Il ne doit pas être pris pour une source de données clients.

## Compatibilité avec faw-shop

Certaines pages Next lisent encore des tables compatibles via Prisma, **dans la base Laravel**. Dans `faw-shop`, `LARAVEL_DATABASE_URL` peut pointer vers cette base en lecture. Ne plus lancer `prisma db push` ni de migration Prisma sur la base Laravel.

## Staging et production

- Bases **isolées** : jamais la base de production sur le staging ou un poste de développement.
- Pour la production, PostgreSQL ou MySQL/MariaDB est recommandé (écritures concurrentes, sauvegardes plus sûres que SQLite).
- Les identifiants se configurent uniquement dans l’environnement du serveur, pas dans Git.
- Toute migration destructive exige un plan de retour approuvé (voir [DEPLOYMENT.md](./DEPLOYMENT.md)).

## Données sensibles

La base contient des clients, commandes, devis, messages et comptes. Elle ne se versionne pas, ne se copie pas sur un poste non autorisé, et ne se transmet pas par messagerie non convenu.

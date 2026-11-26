# FAW Aluminium — API et back-office

API Laravel 12 et administration Filament 4 pour FAW Aluminium (Casablanca). Dépôt **privé** destiné à une organisation GitHub privée. Ce dépôt porte aussi la documentation d’équipe commune (accès, GitHub, staging, déploiement).

La vitrine publique vit dans le dépôt jumeau `faw-shop` (Next.js). Le site public n’affiche aucun prix : tout passe par une demande de devis. Le paiement par carte est désactivé.

## Pile

- PHP 8.2+ · Laravel 12 · Filament 4 · SQLite en local (PostgreSQL ou MySQL recommandé plus tard en production)
- File d’attente et planificateur Laravel disponibles, e-mail de devis via Resend (désactivé tant que la clé n’est pas configurée)

## Structure

```
app/           HTTP, modèles, services, ressources Filament
config/        dont la configuration devis / e-mail (config/faw.php)
database/      migrations et seeders (pas la base SQLite, ignorée)
routes/        API publique et relais d’administration
resources/     vues Filament, documents catalogue
storage/       fichiers privés non versionnés
tests/         PHPUnit (SQLite en mémoire)
docs/          documentation d’équipe et d’exploitation
.github/       CI, modèle de déploiement manuel, CODEOWNERS
```

## Démarrage rapide

```sh
composer install
cp .env.example .env   # seulement sur une installation neuve
chmod 600 .env
php artisan key:generate
php artisan migrate
php artisan db:seed --class=ShopDefaultsSeeder
php artisan storage:link
php artisan serve --host=127.0.0.1 --port=8000
```

Le front (`faw-shop`, port 3100) doit avoir `LARAVEL_ORIGIN=http://127.0.0.1:8000`. L’administration s’ouvre typiquement sur `http://localhost:3100/admin/login`. Les comptes sont individuels ; le mot de passe se demande au propriétaire, jamais dans ce dépôt.

```sh
php artisan test
bash scripts/check-sensitive-files.sh
```

## Documentation

- [Accueil de l’équipe](docs/TEAM_ONBOARDING.md)
- [Installation](docs/INSTALLATION.md)
- [Développement](docs/DEVELOPMENT.md)
- [Déploiement](docs/DEPLOYMENT.md)
- [Base de données](docs/DATABASE.md)
- [Sauvegarde et restauration](docs/BACKUP_RESTORE.md)
- [Sécurité](docs/SECURITY.md)
- [Accès de l’équipe](docs/TEAM_ACCESS.md)
- [Réglages GitHub](docs/GITHUB_SETTINGS.md)
- [Hébergement staging et production](docs/STAGING_HOSTING.md)

Les variables d’environnement sont documentées dans `.env.example` (valeurs d’exemple, secrets vides).

## Règles essentielles

- Dépôt privé ; aucun push ni invitation sans accord du propriétaire.
- Aucun secret, base client, PDF de devis ou journal dans Git.
- Numéros de devis uniquement via le script prévu, à la validation équipe.
- Pas d’e-mail à un vrai client depuis un environnement de test.
- Le rôle Filament `viewer` reste strictement en lecture seule.

# Installation — faw-api

Installation locale de l’API Laravel 12 et du back-office Filament 4. Pour la vitrine, voir `docs/INSTALLATION.md` du dépôt `faw-shop`.

## Prérequis

PHP 8.2+, Composer 2, extensions courantes Laravel (`mbstring`, `intl`, `pdo_sqlite`, `xml`, `ctype`, `json`, `fileinfo`, `tokenizer`), Python 3 si vous générez des devis en local.

## Première installation

```sh
cd faw-api
composer install
cp .env.example .env
chmod 600 .env
php artisan key:generate
# Adapter DB_DATABASE, les chemins DEVIS_* et, si besoin, APP_URL.
# Ne pas coller de secrets de production.
php artisan migrate
php artisan db:seed --class=ShopDefaultsSeeder
php artisan storage:link
```

Création du compte propriétaire (optionnel, installation neuve) :

```sh
# Renseigner FILAMENT_ADMIN_PASSWORD uniquement dans .env, puis :
php artisan faw:owner
```

Cette commande prépare le compte `admin@faw.ma`. Le mot de passe ne s’affiche pas. Sur un environnement déjà en service, ne pas écraser `.env` ni relancer une commande qui recréerait des données.

## Lancer l’API en local

```sh
php artisan serve --host=127.0.0.1 --port=8000
```

Le front Next.js (port 3100) doit pointer `LARAVEL_ORIGIN` vers cette origine. Ne pas occuper le port 8000 s’il sert déjà l’aperçu en cours.

## Vérifications

```sh
php artisan test
vendor/bin/pint --test   # formatage, déjà disponible, non bloquant dans la CI
bash scripts/check-sensitive-files.sh
```

Les tests PHPUnit utilisent une SQLite en mémoire, des scripts de devis copiés sous `/tmp` et un e-mail simulé. Ils ne touchent pas le journal réel des devis ni la base locale de travail.

# Local development setup

PostgreSQL, Redis and Mailpit run in Docker. Laravel (`faw-api`, port 8000) and Next.js (`faw-shop`, port 3100) run on your machine.

## Prerequisites

- Docker with `docker compose`
- PHP 8.2+ with the `pdo_pgsql` extension, Composer 2
- Node 22 and npm
- Python 3 with `reportlab` (quote and catalogue PDFs only)

## 1. Start the services

From the repository root:

```bash
docker compose up -d
docker compose ps        # postgres, redis and mailpit should show "healthy"
```

| Service | Address | Credentials |
|---|---|---|
| PostgreSQL 17 | `127.0.0.1:5433`, databases `faw` and `faw_test` | user `faw`, password `faw_dev_password` (local only) |
| Redis | `127.0.0.1:6379` | none |
| Mailpit | SMTP `127.0.0.1:1025`, inbox at http://localhost:8025 | none |

PostgreSQL is published on **5433** so it does not clash with a native PostgreSQL on 5432. To use another port, run `FAW_DB_PORT=5434 docker compose up -d` and set `DB_PORT` in `faw-api/.env` to match.

## 2. API and back office (faw-api)

```bash
cd faw-api
composer install
cp .env.example .env            # already points to the Docker services
php artisan key:generate
php artisan migrate --seed
# set FILAMENT_ADMIN_PASSWORD in .env first, then:
php artisan faw:owner           # creates admin@faw.ma (super admin)
php artisan serve               # http://127.0.0.1:8000, back office at /admin
```

`migrate --seed` only adds the shop defaults (4 categories, delivery cities, company settings). The catalogue stays empty until you add products in Filament or import the old data with `faw:import-sqlite` (see below).

Run the tests with `php -d memory_limit=1G artisan test`. They use the separate `faw_test` database, never `faw`. On a Windows host, about 34 tests fail because they expect `/tmp` paths, POSIX file permissions and `python3` with `reportlab`. They pass on Linux and in CI.

**Faster local API on Windows.** `php artisan serve` runs without OPcache, so each API call takes about 0.6 s and a shop page about 5 s. If your PHP build ships OPcache, start the API like this instead (about 5 times faster):

```bash
cd faw-api/public
php -d zend_extension=opcache -d opcache.enable_cli=1 -S 127.0.0.1:8000 ../vendor/laravel/framework/src/Illuminate/Foundation/resources/server.php
```

The catalogue PDF (`/api/catalogue.pdf`) needs Python 3 with `reportlab` (`PYTHON_BIN` in `.env`). Without it the endpoint answers 503 instead of a PDF.

## 3. Storefront (faw-shop)

```bash
cd faw-shop
npm ci
cp .env.example .env.local      # LARAVEL_ORIGIN=http://127.0.0.1:8000
npm run dev -- -p 3100          # http://localhost:3100
```

The shop proxies `/admin`, `/api` and `/livewire` to Laravel, so http://localhost:3100/admin also opens the back office.

Set `FORM_SECRET` in `.env.local` to any long random string, otherwise form tokens change at every restart. If port 3100 is taken by another project, use another port (for example `-p 3101`) and update `NEXT_PUBLIC_SITE_URL`.

## Everyday commands

```bash
docker compose stop                    # stop services, keep data
docker compose down -v                 # delete everything, including the database volume
php artisan migrate:fresh --seed       # reset the dev database
php artisan faw:import-sqlite path/to/database.sqlite --force   # load a copy of the old SQLite data
```

All e-mails sent locally land in Mailpit (http://localhost:8025). Quote e-mails go through Resend only when `RESEND_API_KEY` is set, so leave it empty locally.

More detail: [faw-api/docs/DATABASE.md](faw-api/docs/DATABASE.md).

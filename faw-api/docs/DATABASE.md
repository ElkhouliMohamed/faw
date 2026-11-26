# Base de données — faw-api

## Moteur

- **PostgreSQL** partout (local, staging, production). Version locale : PostgreSQL 17 (`docker-compose.yml` à la racine du dépôt).
- Le schéma vit uniquement dans `database/migrations/`. `database/legacy-schema.sql` reste à titre de référence historique (ancien schéma Prisma/SQLite, plus exécuté).
- Les migrations restent portables (constructeur de schéma Laravel) : elles tournent aussi sur SQLite, utile pour un diagnostic ponctuel, mais SQLite n'est plus une cible supportée.
- Commandes : `php artisan migrate`, `php artisan migrate:status`, `php artisan db:seed`.

Le seeder de boutique crée les catégories de base et les paramètres généraux (coordonnées professionnelles). Il ne doit pas être pris pour une source de données clients.

## Local (Docker)

Depuis la racine du dépôt : `docker compose up -d` (voir [DEV-SETUP.md](../../DEV-SETUP.md)).

| Service | Hôte | Port hôte | Remarque |
|---|---|---|---|
| PostgreSQL | 127.0.0.1 | 5433 | base `faw`, utilisateur `faw`, mot de passe de dev `faw_dev_password` ; base `faw_test` pour phpunit |
| Redis | 127.0.0.1 | 6379 | prêt pour cache / sessions / files (nécessite phpredis ou predis) |
| Mailpit | 127.0.0.1 | 1025 (SMTP), 8025 (interface) | capture tous les e-mails envoyés en local |

Le port 5433 évite un PostgreSQL installé nativement sur 5432. Pour le changer : `FAW_DB_PORT=5434 docker compose up -d`, puis `DB_PORT` dans `.env`.

La base `faw_test` est créée au premier démarrage d'un volume vide (`docker/postgres/initdb/`). Sur un volume plus ancien : `docker compose exec postgres createdb -U faw faw_test`.

## Conventions de schéma

- Les tables héritées de Prisma gardent leurs noms en camelCase (`"Product"`, `"updatedAt"`…). En SQL brut sur PostgreSQL, ils **doivent** être entre guillemets ; préférer le constructeur de requêtes, qui les cite automatiquement (`DB::getQueryGrammar()->wrap('o.createdAt')` pour une expression brute, y compris pour les alias camelCase).
- Les anciennes colonnes DATETIME Prisma (`createdAt`, `updatedAt`, `at`, `startsAt`, `tokenExpiresAt`…) sont des **BIGINT en millisecondes epoch** (UTC) : c'est ce qu'écrit le cast `App\Casts\ShopTimestamp`. Comparer avec `now()->getTimestampMs()`, jamais avec une date texte. Valeur par défaut : l'heure du serveur de base en millisecondes.
- Les tables Laravel récentes (`quote_versions`, `customer_orders`, `payments`…) utilisent des `timestamp` classiques.
- `LIKE` est sensible à la casse sur PostgreSQL : normaliser la casse côté PHP ou utiliser `whereLike(..., caseSensitive: false)`.
- `ROUND(x, 2)` exige un `NUMERIC` sur PostgreSQL : `ROUND(CAST(... AS NUMERIC), 2)`.
- Les versions de devis sont immuables au niveau base (déclencheurs `quote_versions_frozen` / `quote_versions_no_delete`).

## Tests

`phpunit.xml` force `DB_CONNECTION=pgsql` et `DB_DATABASE=faw_test` (jamais la base de dev). Hôte, port, utilisateur et mot de passe viennent de `.env` ou de l'environnement. `php artisan test` exige donc que le conteneur PostgreSQL tourne.

## Migration SQLite → PostgreSQL (une seule fois, en production)

1. Mettre le site en maintenance (`php artisan down`) et copier le fichier SQLite de production (`cp database/database.sqlite /chemin/sauvegarde/faw-AAAAMMJJ.sqlite`). Garder cette copie hors ligne : elle contient des données clients.
2. S'assurer que la copie SQLite est à jour de toutes les migrations (`php artisan migrate:status` avec l'ancien `.env` SQLite).
3. Créer la base PostgreSQL vide et renseigner `DB_*` dans le `.env` du serveur. Garder **le même `APP_KEY`** : `SystemConfig` et les secrets TOTP sont chiffrés avec.
4. `php artisan migrate --force` (schéma vide).
5. `php artisan faw:import-sqlite /chemin/sauvegarde/faw-AAAAMMJJ.sqlite --force`
   - copie toutes les tables communes, parents avant enfants, en une seule transaction (tout ou rien) ;
   - `--force` est nécessaire car les migrations ont déjà créé quelques lignes (ex. `SystemConfig`, attribut `hauteur`), remplacées par celles de la source ;
   - convertit les booléens, les dates texte de SQLite en millisecondes epoch, et les millisecondes en `timestamp` pour les tables Laravel ;
   - ignore `migrations`, `cache`, `sessions`, `jobs` ;
   - réinitialise les séquences PostgreSQL puis compare le nombre de lignes source / cible (code de sortie non nul en cas d'écart).
   - `--only=Product --only=Category` limite l'import à certaines tables.
6. Vérifier le back-office, puis `php artisan up`. Plan de retour : remettre `DB_CONNECTION=sqlite` et l'ancien fichier, aucune donnée n'est modifiée côté SQLite.

## Staging et production

- Bases **isolées** : jamais la base de production sur le staging ou un poste de développement.
- Les identifiants se configurent uniquement dans l'environnement du serveur, pas dans Git. Le mot de passe de dev de `docker-compose.yml` ne sert qu'en local.
- Sauvegardes : `pg_dump -Fc` (voir [BACKUP_RESTORE.md](./BACKUP_RESTORE.md)).
- Toute migration destructive exige un plan de retour approuvé (voir [DEPLOYMENT.md](./DEPLOYMENT.md)).

## Données sensibles

La base contient des clients, commandes, devis, messages et comptes. Elle ne se versionne pas, ne se copie pas sur un poste non autorisé, et ne se transmet pas par messagerie non convenue.

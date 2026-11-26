<?php

namespace App\Console\Commands;

use Carbon\CarbonImmutable;
use Illuminate\Console\Command;
use Illuminate\Database\Connection;
use Illuminate\Support\Facades\DB;
use Throwable;

/**
 * One-time move of the historical SQLite database into the current connection (PostgreSQL).
 *
 * Usage (target schema already migrated, see docs/DATABASE.md):
 *   php artisan migrate:fresh --force
 *   php artisan faw:import-sqlite /chemin/vers/database.sqlite --force
 *
 * Every table that exists on both sides is copied (columns present on both sides only), parents before
 * children (foreign keys of the target), in a single transaction. Values are converted to the target
 * column type (booleans, epoch-millisecond timestamps, dates). PostgreSQL sequences are reset afterwards.
 */
class ImportSqlite extends Command
{
    protected $signature = 'faw:import-sqlite
        {path : Fichier SQLite source (copie de la base de production)}
        {--force : Remplacer les données déjà présentes dans les tables cibles}
        {--only=* : Limiter l\'import à ces tables}';

    protected $description = 'Copier toutes les données d\'une base SQLite vers la connexion courante (PostgreSQL), puis réinitialiser les séquences';

    /** Laravel runtime tables: never copied (the target keeps its own migration history, caches and sessions are disposable). */
    private const SKIP = ['migrations', 'cache', 'cache_locks', 'sessions', 'jobs', 'job_batches', '_prisma_migrations'];

    private const SOURCE = 'faw_import_source';

    public function handle(): int
    {
        $path = realpath((string) $this->argument('path'));
        if (! $path || ! is_file($path)) {
            $this->error('Fichier SQLite introuvable : '.$this->argument('path'));

            return self::FAILURE;
        }
        $target = DB::connection();
        if ($target->getDriverName() === 'sqlite' && realpath((string) $target->getDatabaseName()) === $path) {
            $this->error('La source et la cible sont la même base.');

            return self::FAILURE;
        }

        config(['database.connections.'.self::SOURCE => ['driver' => 'sqlite', 'database' => $path, 'prefix' => '', 'foreign_key_constraints' => false]]);
        $source = DB::connection(self::SOURCE);

        $sourceTables = $this->tables($source);
        $targetTables = $this->tables($target);
        $only = array_filter((array) $this->option('only'));
        $tables = array_values(array_filter(
            array_intersect($sourceTables, $targetTables),
            fn ($t) => ! in_array($t, self::SKIP, true) && ($only === [] || in_array($t, $only, true))
        ));
        foreach (array_diff($sourceTables, $targetTables, self::SKIP) as $missing) {
            if (! str_starts_with($missing, 'sqlite_')) {
                $this->warn("Table absente de la cible, ignorée : {$missing}");
            }
        }
        if ($tables === []) {
            $this->error('Aucune table commune à importer. La cible est-elle migrée (php artisan migrate) ?');

            return self::FAILURE;
        }
        $tables = $this->parentsFirst($target, $tables);

        $notEmpty = array_values(array_filter($tables, fn ($t) => $target->table($t)->exists()));
        if ($notEmpty !== [] && ! $this->option('force')) {
            $this->error('Ces tables cibles contiennent déjà des données : '.implode(', ', $notEmpty));
            $this->line('Relancer avec --force pour les remplacer (les lignes créées par les migrations, ex. SystemConfig, seront écrasées par celles de la source).');

            return self::FAILURE;
        }

        $this->info('Import de '.count($tables).' tables depuis '.$path.' vers '.$target->getDriverName().' ('.$target->getDatabaseName().')');
        $report = [];
        try {
            $target->transaction(function () use ($source, $target, $tables, &$report) {
                if ($target->getDriverName() === 'pgsql') {
                    // TRUNCATE skips row-level DELETE triggers (quote_versions_no_delete) and stays transactional.
                    // No CASCADE: a table outside the import that references these ones makes the import fail instead of being emptied silently.
                    $target->statement('TRUNCATE TABLE '.implode(', ', array_map(fn ($t) => $target->getQueryGrammar()->wrapTable($t), $tables)).' RESTART IDENTITY');
                } else {
                    // Children first when emptying, parents first when filling.
                    foreach (array_reverse($tables) as $table) {
                        $target->table($table)->delete();
                    }
                }
                foreach ($tables as $table) {
                    $report[] = [$table, $source->table($table)->count(), $this->copy($source, $target, $table)];
                }
            });
        } catch (Throwable $e) {
            $this->error('Import annulé, aucune donnée modifiée : '.$e->getMessage());

            return self::FAILURE;
        } finally {
            DB::purge(self::SOURCE);
        }

        $sequences = $this->resetSequences($target);
        $this->table(['Table', 'Source', 'Copiées'], $report);
        if ($sequences) {
            $this->line("Séquences PostgreSQL réinitialisées : {$sequences}");
        }
        $mismatch = array_filter($report, fn ($r) => $r[1] !== $r[2] || $target->table($r[0])->count() !== $r[1]);
        if ($mismatch) {
            $this->error('Nombre de lignes différent pour : '.implode(', ', array_column($mismatch, 0)));

            return self::FAILURE;
        }
        $this->info('Import terminé.');

        return self::SUCCESS;
    }

    /** @return list<string> */
    private function tables(Connection $c): array
    {
        $schema = $c->getDriverName() === 'pgsql' ? $c->scalar('select current_schema()') : null;

        return collect($c->getSchemaBuilder()->getTables())
            ->filter(fn ($t) => $schema === null || ($t['schema'] ?? $schema) === $schema)
            ->pluck('name')->values()->all();
    }

    /**
     * Topological order on the target foreign keys (a table comes after the tables it references).
     *
     * @param  list<string>  $tables
     * @return list<string>
     */
    private function parentsFirst(Connection $c, array $tables): array
    {
        sort($tables);
        $deps = [];
        foreach ($tables as $t) {
            $deps[$t] = collect($c->getSchemaBuilder()->getForeignKeys($t))
                ->pluck('foreign_table')->filter(fn ($p) => $p !== $t && in_array($p, $tables, true))->unique()->values()->all();
        }
        $ordered = [];
        while ($deps) {
            $ready = array_keys(array_filter($deps, fn ($d) => array_diff($d, $ordered) === []));
            if ($ready === []) { // cycle: keep the remaining tables in name order
                $ready = array_keys($deps);
            }
            foreach ($ready as $t) {
                $ordered[] = $t;
                unset($deps[$t]);
            }
        }

        return $ordered;
    }

    private function copy(Connection $source, Connection $target, string $table): int
    {
        $types = collect($target->getSchemaBuilder()->getColumns($table))->mapWithKeys(fn ($c) => [$c['name'] => strtolower($c['type_name'])])->all();
        $sourceColumns = array_column($source->getSchemaBuilder()->getColumns($table), 'name');
        $columns = array_values(array_intersect($sourceColumns, array_keys($types)));
        if ($dropped = array_diff($sourceColumns, $columns)) {
            $this->warn("{$table} : colonnes absentes de la cible, ignorées : ".implode(', ', $dropped));
        }
        // Stay well under the PostgreSQL limit of 65535 bound parameters per statement.
        $chunk = max(1, min(500, intdiv(30000, max(1, count($columns)))));
        $copied = 0;
        $batch = [];
        foreach ($source->table($table)->select($columns)->orderByRaw('rowid')->cursor() as $row) {
            $out = [];
            foreach ($columns as $col) {
                $out[$col] = $this->convert($row->{$col}, $types[$col], $table, $col);
            }
            $batch[] = $out;
            if (count($batch) >= $chunk) {
                $target->table($table)->insert($batch);
                $copied += count($batch);
                $batch = [];
            }
        }
        if ($batch) {
            $target->table($table)->insert($batch);
            $copied += count($batch);
        }

        return $copied;
    }

    private function convert(mixed $v, string $type, string $table, string $col): mixed
    {
        if ($v === null) {
            return null;
        }
        if (in_array($type, ['bool', 'boolean'], true)) {
            return is_string($v) ? in_array(strtolower(trim($v)), ['1', 'true', 't', 'yes', 'on'], true) : (bool) $v;
        }
        if (in_array($type, ['int8', 'bigint'], true) && is_string($v) && $v !== '' && ! is_numeric($v)) {
            // Former Prisma DATETIME written as text by a SQLite CURRENT_TIMESTAMP default: store epoch milliseconds.
            try {
                return CarbonImmutable::parse($v, 'UTC')->getTimestampMs();
            } catch (Throwable) {
                throw new \RuntimeException("{$table}.{$col} : valeur non convertible en horodatage « {$v} »");
            }
        }
        if (in_array($type, ['timestamp', 'timestamptz', 'date'], true) && is_numeric($v)) {
            $d = CarbonImmutable::createFromTimestampMs((int) $v, 'UTC');

            return $type === 'date' ? $d->toDateString() : $d->format('Y-m-d H:i:s.v');
        }
        if (is_string($v) && in_array($type, ['text', 'varchar', 'bpchar', 'json', 'jsonb'], true) && str_contains($v, "\0")) {
            return str_replace("\0", '', $v); // PostgreSQL text cannot hold NUL bytes
        }

        return $v;
    }

    /** Align every serial / identity sequence on MAX(id) so new rows never collide with imported ones. */
    private function resetSequences(Connection $c): int
    {
        if ($c->getDriverName() !== 'pgsql') {
            return 0;
        }
        $n = 0;
        foreach ($this->tables($c) as $table) {
            foreach ($c->getSchemaBuilder()->getColumns($table) as $col) {
                if (! ($col['auto_increment'] ?? false)) {
                    continue;
                }
                $seq = $c->scalar('select pg_get_serial_sequence(?, ?)', [$c->getQueryGrammar()->wrapTable($table), $col['name']]);
                if (! $seq) {
                    continue;
                }
                $max = (int) $c->table($table)->max($col['name']);
                $c->select('select setval(?::regclass, ?, ?)', [$seq, max($max, 1), $max > 0]);
                $n++;
            }
        }

        return $n;
    }
}

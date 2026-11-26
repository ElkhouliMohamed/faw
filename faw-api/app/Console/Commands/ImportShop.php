<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use PDO;

class ImportShop extends Command
{
    protected $signature = 'faw:import {backup : Copie SQLite locale}';

    protected $description = 'Importer une copie locale du catalogue et CRM, sans écraser les données existantes';

    public function handle(): int
    {
        $path = realpath($this->argument('backup'));
        if (! $path || ! str_starts_with($path, '/tmp/')) {
            $this->error('Utiliser une sauvegarde locale dans /tmp.');

            return 1;
        }
        $src = new PDO('sqlite:'.$path);
        $src->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
        $tables = ['Category', 'Product', 'Contact', 'Order', 'OrderItem', 'Quote', 'LeadEvent', 'Interaction', 'Task', 'Setting'];
        DB::transaction(function () use ($tables, $src) {
            foreach ($tables as $table) {
                $count = 0;
                foreach ($src->query('SELECT * FROM "'.$table.'"') as $row) {
                    $count += DB::table($table)->insertOrIgnore($row);
                }$this->info($table.': '.$count);
            }
        });

        return 0;
    }
}

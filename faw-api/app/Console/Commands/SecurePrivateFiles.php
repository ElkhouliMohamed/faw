<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;

/** Owner-only permissions on quote PDFs and private storage (files 0600, directories 0700). Idempotent. */
class SecurePrivateFiles extends Command
{
    protected $signature = 'faw:secure-files {--dry-run : Only list what would change}';

    protected $description = 'Restreint au propriétaire les PDF de devis et le stockage privé';

    public function handle(): int
    {
        $roots = array_filter([config('faw.output'), storage_path('app/private')], fn ($p) => $p && is_dir($p));
        $changed = 0;
        foreach (array_unique(array_map('realpath', $roots)) as $root) {
            $it = new \RecursiveIteratorIterator(new \RecursiveDirectoryIterator($root, \FilesystemIterator::SKIP_DOTS), \RecursiveIteratorIterator::SELF_FIRST);
            foreach ([$root => new \SplFileInfo($root)] + iterator_to_array($it) as $path => $info) {
                if ($info->isLink()) {
                    continue;
                }
                $want = $info->isDir() ? 0700 : 0600;
                if (($info->getPerms() & 0777) !== $want) {
                    $changed++;
                    if (! $this->option('dry-run')) {
                        @chmod($path, $want);
                    }
                }
            }
            $this->line(basename($root).' : vérifié');
        }
        $this->info(($this->option('dry-run') ? 'À corriger : ' : 'Corrigés : ').$changed);

        return self::SUCCESS;
    }
}

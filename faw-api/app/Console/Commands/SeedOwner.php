<?php

namespace App\Console\Commands;

use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Hash;

class SeedOwner extends Command
{
    protected $signature = 'faw:owner';

    protected $description = 'Créer le propriétaire depuis FILAMENT_ADMIN_PASSWORD (jamais affiché)';

    public function handle(): int
    {
        $password = env('FILAMENT_ADMIN_PASSWORD');
        if (! $password) {
            $this->error('Mot de passe absent de la configuration privée.');

            return 1;
        }
        User::firstOrCreate(['email' => 'admin@faw.ma'], ['name' => 'FAW Aluminium', 'role' => 'super_admin', 'is_active' => true, 'password' => Hash::make($password)]);
        $this->info('Compte admin@faw.ma prêt.');

        return 0;
    }
}

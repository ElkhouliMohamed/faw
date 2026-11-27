<?php

namespace Database\Seeders;

use App\Models\ContentPage;
use App\Models\SiteMenu;
use App\Services\HomeTemplate;
use Illuminate\Database\Seeder;

/**
 * The client's home page model as editable records: the home page (if none exists) and the header / footer menus
 * (only the locations that have no menu yet). Idempotent: never overwrites what the client already edited.
 *
 *   php artisan db:seed --class=HomeTemplateSeeder
 */
class HomeTemplateSeeder extends Seeder
{
    public function run(): void
    {
        if (! ContentPage::where('kind', 'home')->exists()) {
            ContentPage::create([
                'kind' => 'home', 'slug' => 'accueil', 'title' => 'Accueil', 'title_ar' => 'الرئيسية',
                'published' => true, 'blocks' => HomeTemplate::sections(),
            ]);
        }
        foreach (HomeTemplate::menus() as $location => $menu) {
            if (! SiteMenu::where('location', $location)->exists()) {
                SiteMenu::create(['location' => $location, 'active' => true] + $menu);
            }
        }
    }
}

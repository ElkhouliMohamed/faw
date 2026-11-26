<?php

namespace Database\Seeders;

use App\Models\Category;
use App\Models\Setting;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class ShopDefaultsSeeder extends Seeder
{
    public function run(): void
    {
        $cats = [['portes-coupe-feu', 'Portes coupe-feu', 'Coupe-feu EI60', '/images/products/CF-EI60-120-2V.jpg'], ['galandage', 'Portes coulissantes encastrables', 'Galandage', '/images/products/GAL-800.jpg'], ['incendie', 'Incendie', 'Matériel incendie', '/images/products/EXT-CO2-6.jpg'], ['automatisme', 'Automatisme', 'Kit portail', '/images/products/AUTO-GBAT300-230V.jpg']];
        foreach ($cats as $i => $c) {
            Category::firstOrCreate(['slug' => $c[0]], ['label' => $c[1], 'short' => $c[2], 'family' => $c[0], 'image' => $c[3], 'sortOrder' => $i, 'updatedAt' => now()]);
        }
        foreach ([['casablanca', 'Casablanca', 400], ['rabat', 'Rabat', 800]] as $i => $city) {
            if (! DB::table('ShippingCity')->where('slug', $city[0])->exists()) {
                DB::table('ShippingCity')->insert(['slug' => $city[0], 'name' => $city[1], 'fee' => $city[2], 'sortOrder' => $i, 'updatedAt' => now()->getTimestampMs()]);
            }
        }
        foreach (['company_name' => 'FAW Aluminium', 'office_address' => '21 Rue Al Yazidi Mohamed, Casablanca', 'depot_address' => '', 'ice' => '', 'rc' => '', 'phone' => '+212 522 865 202', 'email' => 'faw@faw.ma', 'instagram' => '', 'linkedin' => '', 'facebook' => 'https://www.facebook.com/profile.php?id=61560516980314'] as $key => $value) {
            Setting::firstOrCreate(['key' => $key], ['value' => $value, 'updatedAt' => now()]);
        }
    }
}

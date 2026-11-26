<?php

use App\Support\DoorHeight;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DoorHeight::backfill();
    }

    public function down(): void
    {
        foreach (DB::table('Product')->where('category', 'Portes coupe-feu')->get() as $row) {
            $attrs = json_decode((string) ($row->attributes ?: '{}'), true);
            if (! is_array($attrs) || ! array_key_exists('hauteur', $attrs)) {
                continue;
            }
            unset($attrs['hauteur']);
            DB::table('Product')->where('id', $row->id)->update([
                'attributes' => json_encode($attrs ?: new \stdClass, JSON_UNESCAPED_UNICODE),
            ]);
        }
        DB::table('Attribute')->where('key', 'hauteur')->delete();
    }
};

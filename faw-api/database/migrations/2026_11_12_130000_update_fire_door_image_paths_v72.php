<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        $this->rewrite('/images/products/v7/', '/images/products/v7-2/');
    }

    public function down(): void
    {
        $this->rewrite('/images/products/v7-2/', '/images/products/v7/');
    }

    private function rewrite(string $from, string $to): void
    {
        foreach (DB::table('Product')->where('category', 'Portes coupe-feu')->where('image', 'like', $from.'%')->get() as $row) {
            DB::table('Product')->where('id', $row->id)->update([
                'image' => str_replace($from, $to, $row->image),
                'updatedAt' => now()->getTimestampMs(),
            ]);
        }
        foreach (DB::table('Category')->where('image', 'like', $from.'CF-EI60-%')->get() as $row) {
            DB::table('Category')->where('id', $row->id)->update([
                'image' => str_replace($from, $to, $row->image),
                'updatedAt' => now()->getTimestampMs(),
            ]);
        }
    }
};

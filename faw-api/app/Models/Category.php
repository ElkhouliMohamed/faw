<?php

namespace App\Models;

use Illuminate\Validation\ValidationException;

class Category extends ShopModel
{
    protected $table = 'Category';

    public $timestamps = false;

    protected $guarded = [];

    protected static function booted(): void
    {
        parent::booted();
        static::saving(function (Category $category) {
            $category->parentId = $category->parentId ?: null;
            if ($category->parentId && $category->exists && in_array((int) $category->parentId, [$category->id, ...$category->descendantIds()], true)) {
                throw ValidationException::withMessages(['parentId' => 'Une catégorie ne peut pas être rangée sous elle-même ou sous une de ses sous-catégories.']);
            }
            if ($category->parentId && ! static::whereKey($category->parentId)->exists()) {
                throw ValidationException::withMessages(['parentId' => 'Catégorie parente introuvable.']);
            }
        });
        static::deleting(function ($category) {
            if (static::where('parentId', $category->id)->exists()) {
                throw ValidationException::withMessages(['label' => 'Déplacez les sous-catégories avant de supprimer cette catégorie.']);
            }
        });
        static::updated(function ($category) {
            if ($category->wasChanged('label')) {
                Product::where('category', $category->getOriginal('label'))->update(['category' => $category->label]);
            }
        });
        static::deleting(function ($category) {
            if (Product::where('category', $category->label)->exists()) {
                throw ValidationException::withMessages(['label' => 'Réaffectez les produits avant de supprimer cette catégorie.']);
            }
        });
    }

    protected $casts = ['active' => 'boolean', 'sortOrder' => 'integer', 'parentId' => 'integer'];

    /** @return list<int> ids of every sub-category, any depth. */
    public function descendantIds(): array
    {
        $out = [];
        $frontier = [$this->id];
        while ($frontier !== []) {
            $children = static::whereIn('parentId', $frontier)->pluck('id')->map(fn ($i) => (int) $i)->all();
            $children = array_values(array_diff($children, $out));
            $out = [...$out, ...$children];
            $frontier = $children;
        }

        return $out;
    }
}

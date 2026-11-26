<?php

namespace App\Models;

use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;

class Media extends ShopModel
{
    protected $table = 'Media';

    public $timestamps = false;

    protected $guarded = [];

    protected static function booted(): void
    {
        parent::booted();
        static::saving(function ($m) {
            if ($m->isDirty('file')) {
                if (! preg_match('#^media/[a-zA-Z0-9_-]+\.(?:jpg|jpeg|png|webp|gif|avif)$#i', $m->file ?? '')) {
                    throw ValidationException::withMessages(['file' => 'Nom de fichier non autorisé.']);
                }$path = Storage::disk('public')->path($m->file);
                if (! is_file($path) || ! ($info = @getimagesize($path)) || ! in_array($info['mime'] ?? '', ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'])) {
                    throw ValidationException::withMessages(['file' => 'Image non valide.']);
                }if (filesize($path) > 4 * 1024 * 1024) {
                    throw ValidationException::withMessages(['file' => 'Image trop grande.']);
                }$m->url = '/storage/'.$m->file;
                $m->width = $info[0];
                $m->height = $info[1];
                $m->size = filesize($path);
                $m->originalName = basename($m->file);
            }if ($m->alt === null) {
                $m->alt = '';
            }
        });
        static::deleted(function ($m) {
            if (preg_match('#^media/[a-zA-Z0-9_-]+\.(?:jpg|jpeg|png|webp|gif|avif)$#i', $m->file ?? '')) {
                Storage::disk('public')->delete($m->file);
            }
        });
    }
}

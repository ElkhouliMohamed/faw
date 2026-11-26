<?php

namespace App\Filament\Avatars;

use Filament\AvatarProviders\Contracts\AvatarProvider;
use Filament\Facades\Filament;
use Illuminate\Contracts\Auth\Authenticatable;
use Illuminate\Database\Eloquent\Model;

/** Avatar local (SVG en data URI, initiales sur l'orange FAW) : aucun appel à un service externe. */
class InitialsAvatar implements AvatarProvider
{
    public function get(Model|Authenticatable $record): string
    {
        $name = (string) Filament::getNameForDefaultAvatar($record);
        $initials = collect(preg_split('/\s+/u', trim($name)) ?: [])->filter()->take(2)->map(fn ($w) => mb_strtoupper(mb_substr($w, 0, 1)))->implode('') ?: 'F';
        $svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="32" fill="#f38f26"/><text x="32" y="41" text-anchor="middle" font-family="Arial,sans-serif" font-size="24" font-weight="700" fill="#2b1a0b">'.e($initials).'</text></svg>';

        return 'data:image/svg+xml;base64,'.base64_encode($svg);
    }
}

<?php

namespace App\Filament\Resources;

use App\Support\ResourceAccess;
use Filament\Resources\Resource;
use Illuminate\Auth\Access\Response;
use Illuminate\Database\Eloquent\Model;

abstract class OwnerResource extends Resource
{
    public static function canViewAny(): bool
    {
        return static::userCan(ResourceAccess::abilities(static::class)['view']);
    }

    public static function canView(Model $record): bool
    {
        return static::canViewAny();
    }

    protected static function decision(bool $allowed): Response
    {
        return $allowed ? Response::allow() : Response::deny('Accès en lecture seule ou interdit.');
    }

    public static function getViewAnyAuthorizationResponse(): Response
    {
        return static::decision(static::canViewAny());
    }

    public static function getViewAuthorizationResponse(Model $record): Response
    {
        return static::decision(static::canView($record));
    }

    public static function getCreateAuthorizationResponse(): Response
    {
        return static::decision(static::canCreate());
    }

    public static function getEditAuthorizationResponse(Model $record): Response
    {
        return static::decision(static::canEdit($record));
    }

    public static function getDeleteAuthorizationResponse(Model $record): Response
    {
        return static::decision(static::canDelete($record));
    }

    public static function getDeleteAnyAuthorizationResponse(): Response
    {
        return static::decision(static::canDeleteAny());
    }

    public static function canCreate(): bool
    {
        return static::userCan(ResourceAccess::abilities(static::class)['create']);
    }

    public static function canEdit(Model $record): bool
    {
        return static::userCan(ResourceAccess::abilities(static::class)['write']);
    }

    public static function canDelete(Model $record): bool
    {
        return static::userCan(ResourceAccess::abilities(static::class)['create']);
    }

    public static function canDeleteAny(): bool
    {
        return static::canCreate();
    }

    /** @param  list<string>  $abilities */
    protected static function userCan(array $abilities): bool
    {
        $user = auth()->user();
        if (! $user || $abilities === []) {
            return false;
        }
        foreach ($abilities as $ability) {
            if ($user->canDo($ability)) {
                return true;
            }
        }

        return false;
    }
}

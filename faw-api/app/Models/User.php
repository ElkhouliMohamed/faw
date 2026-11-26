<?php

namespace App\Models;

use App\Support\Role;
use Database\Factories\UserFactory;
use Filament\Auth\MultiFactor\App\Concerns\InteractsWithAppAuthentication;
use Filament\Auth\MultiFactor\App\Concerns\InteractsWithAppAuthenticationRecovery;
use Filament\Auth\MultiFactor\App\Contracts\HasAppAuthentication;
use Filament\Auth\MultiFactor\App\Contracts\HasAppAuthenticationRecovery;
use Filament\Models\Contracts\FilamentUser;
use Filament\Panel;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Illuminate\Validation\ValidationException;

class User extends Authenticatable implements FilamentUser, HasAppAuthentication, HasAppAuthenticationRecovery
{
    /** @use HasFactory<UserFactory> */
    use HasFactory, InteractsWithAppAuthentication, InteractsWithAppAuthenticationRecovery, Notifiable;

    protected $attributes = [
        'role' => 'viewer',
        'is_active' => true,
    ];

    protected static function booted(): void
    {
        static::saving(function (User $user) {
            if ($user->exists && $user->wouldRemoveLastSuperAdmin()) {
                throw ValidationException::withMessages([
                    'role' => 'Conservez au moins un super administrateur actif.',
                ]);
            }
        });
        static::deleting(function (User $user) {
            if ($user->isSuperAdmin() && $user->isActive() && static::activeSuperAdminQuery()->whereKeyNot($user->getKey())->count() === 0) {
                throw ValidationException::withMessages([
                    'role' => 'Conservez au moins un super administrateur actif.',
                ]);
            }
        });
        foreach (['created', 'updated'] as $event) {
            static::$event(function (User $user) use ($event) {
                if (auth()->check()) {
                    AuditEntry::create([
                        'at' => now(),
                        'actor' => auth()->user()->email,
                        'action' => $event,
                        'entity' => 'users',
                        'entityId' => (string) $user->id,
                        'summary' => 'Compte ou rôle modifié',
                        'changes' => AuditEntry::safeChanges($user, $event),
                    ]);
                }
            });
        }
    }

    public function canAccessPanel(Panel $panel): bool
    {
        return $this->isActive() && $this->roleEnum() !== null;
    }

    public function isActive(): bool
    {
        return (bool) $this->is_active;
    }

    public function roleEnum(): ?Role
    {
        return Role::resolve($this->role);
    }

    public function isSuperAdmin(): bool
    {
        return $this->roleEnum() === Role::SuperAdmin;
    }

    public function canDo(string $ability): bool
    {
        if (! $this->isActive()) {
            return false;
        }

        return $this->roleEnum()?->can($ability) ?? false;
    }

    public function wouldRemoveLastSuperAdmin(): bool
    {
        $wasSuper = $this->exists
            && in_array($this->getOriginal('role'), [Role::SuperAdmin->value, 'admin'], true)
            && (bool) ($this->getOriginal('is_active') ?? true);
        $willBeSuper = $this->isSuperAdmin() && $this->isActive();

        return $wasSuper && ! $willBeSuper && static::activeSuperAdminQuery()->whereKeyNot($this->getKey())->count() === 0;
    }

    public static function activeSuperAdminQuery()
    {
        return static::query()->where('is_active', true)->whereIn('role', [Role::SuperAdmin->value, 'admin']);
    }

    protected $fillable = [
        'name',
        'email',
        'password',
        'role',
        'is_active',
    ];

    protected $hidden = [
        'password',
        'remember_token',
    ];

    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'is_active' => 'boolean',
        ];
    }
}

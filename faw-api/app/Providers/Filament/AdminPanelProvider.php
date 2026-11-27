<?php

namespace App\Providers\Filament;

use App\Filament\Pages\Auth\EditProfile;
use App\Filament\Pages\Dashboard;
use Filament\Auth\MultiFactor\App\AppAuthentication;
use Filament\Http\Middleware\Authenticate;
use Filament\Http\Middleware\AuthenticateSession;
use Filament\Http\Middleware\DisableBladeIconComponents;
use Filament\Http\Middleware\DispatchServingFilamentEvent;
use Filament\Panel;
use Filament\PanelProvider;
use Filament\Support\Colors\Color;
use Filament\View\PanelsRenderHook;
use Illuminate\Cookie\Middleware\AddQueuedCookiesToResponse;
use Illuminate\Cookie\Middleware\EncryptCookies;
use Illuminate\Foundation\Http\Middleware\VerifyCsrfToken;
use Illuminate\Routing\Middleware\SubstituteBindings;
use Illuminate\Session\Middleware\StartSession;
use Illuminate\View\Middleware\ShareErrorsFromSession;

class AdminPanelProvider extends PanelProvider
{
    public function panel(Panel $panel): Panel
    {
        return $panel
            ->default()
            ->id('admin')
            ->path('admin')
            ->brandName('FAW Aluminium')
            // Sidebar order. Groups without any visible page are simply not shown; the legacy names
            // ("Marketing & SEO", "Communication") stay listed so they keep their place while resources move.
            ->navigationGroups(['Ventes', 'Catalogue', 'Contenu', 'Clients', 'Marketing', 'Marketing & SEO', 'Communication', 'Paramètres', 'Système'])
            ->sidebarCollapsibleOnDesktop()
            // SPA navigation (wire:navigate). Downloads and private files served outside Filament are excluded.
            ->spa()
            ->spaUrlExceptions([
                '*/admin/quotes/*/pdf',
                '*/admin/quotes/*/versions/*/pdf',
                '*/admin/payments/*/proof',
                '*/admin/attachments/*',
            ])
            ->login()
            // « Mon profil » : changement de son propre mot de passe + double authentification FACULTATIVE (TOTP + codes de secours).
            ->profile(EditProfile::class, isSimple: false)
            ->multiFactorAuthentication([AppAuthentication::make()->recoverable()->brandName('FAW Aluminium')], isRequired: false)
            ->colors([
                // Orange du logo FAW (#F38F26), neutres chauds
                'primary' => Color::hex('#f38f26'),
                'gray' => Color::Stone,
            ])
            ->brandLogo('/brand/logo-faw.png')
            ->darkModeBrandLogo('/brand/logo-faw-dark.png')
            ->brandLogoHeight('2.1rem')
            ->favicon('/brand/icon.png')
            ->defaultAvatarProvider(\App\Filament\Avatars\InitialsAvatar::class)
            ->renderHook(PanelsRenderHook::HEAD_END, fn () => view('filament.faw-theme'))
            ->discoverResources(in: app_path('Filament/Resources'), for: 'App\Filament\Resources')
            ->discoverPages(in: app_path('Filament/Pages'), for: 'App\Filament\Pages')
            ->pages([
                Dashboard::class,
            ])
            // Widgets are placed explicitly by App\Filament\Pages\Dashboard and Analytics (none is auto-discovered).
            ->discoverWidgets(in: app_path('Filament/Widgets'), for: 'App\Filament\Widgets')
            ->middleware([
                EncryptCookies::class,
                AddQueuedCookiesToResponse::class,
                StartSession::class,
                AuthenticateSession::class,
                ShareErrorsFromSession::class,
                VerifyCsrfToken::class,
                SubstituteBindings::class,
                DisableBladeIconComponents::class,
                DispatchServingFilamentEvent::class,
            ])
            ->authMiddleware([
                Authenticate::class,
            ]);
    }
}

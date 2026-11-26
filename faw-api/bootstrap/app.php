<?php

use App\Http\Middleware\PreviewSecurity;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->redirectGuestsTo('/admin/login');
        $middleware->append(PreviewSecurity::class);
        $middleware->trustProxies(at: ['127.0.0.1', '::1']);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        // Never flash or log these request fields (raw link tokens, credentials).
        $exceptions->dontFlash(['current_password', 'password', 'password_confirmation', 'token', 'tokenHash', 'resendKey', 'merchantSecret', 'apiKey']);
    })->create();

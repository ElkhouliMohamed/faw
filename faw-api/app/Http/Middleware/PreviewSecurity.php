<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\BinaryFileResponse;
use Symfony\Component\HttpFoundation\Response;

/**
 * Security headers and cookie hardening for every Laravel response (API, Filament, private files).
 * HSTS is sent only on HTTPS requests in production, never on the local / ngrok preview.
 */
class PreviewSecurity
{
    public const ADMIN_CSP = "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'";

    public const API_CSP = "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'";

    public function handle(Request $request, Closure $next)
    {
        // Session cookie: Secure whenever the request arrived over HTTPS (trusted proxy aware), HttpOnly, SameSite=Lax.
        config([
            'session.secure' => $request->isSecure(),
            'session.http_only' => true,
            'session.same_site' => in_array(config('session.same_site'), ['lax', 'strict'], true) ? config('session.same_site') : 'lax',
        ]);

        /** @var Response $response */
        $response = $next($request);
        $h = $response->headers;
        $h->set('X-Content-Type-Options', 'nosniff');
        $h->set('X-Frame-Options', 'DENY');
        $h->set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()');
        $h->set('Cross-Origin-Opener-Policy', 'same-origin');
        if (! $h->has('Referrer-Policy')) {
            $h->set('Referrer-Policy', 'strict-origin-when-cross-origin');
        }

        if ($request->is('admin*', 'livewire*', 'filament*')) {
            $h->set('Cache-Control', 'private, no-store');
            $h->set('X-Robots-Tag', 'noindex, nofollow');
            $h->set('Referrer-Policy', 'no-referrer');
            $h->set('Content-Security-Policy', self::ADMIN_CSP);
        } elseif ($request->is('api/*') && ! $response instanceof BinaryFileResponse) {
            $h->set('Content-Security-Policy', self::API_CSP);
        }
        if ($request->is('api/quotes/*')) {
            $h->set('Referrer-Policy', 'no-referrer');
            $h->set('X-Robots-Tag', 'noindex, nofollow');
            $h->set('Cache-Control', 'private, no-store');
        }

        if ($request->isSecure() && app()->environment('production')) {
            $h->set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
        }

        return $response;
    }
}

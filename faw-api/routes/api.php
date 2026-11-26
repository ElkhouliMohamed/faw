<?php

use App\Http\Controllers\CatalogPdfController;
use App\Http\Controllers\CompatibilityController;
use App\Http\Controllers\ContentController;
use App\Http\Controllers\InboxController;
use App\Http\Controllers\PaymentWebhookController;
use App\Http\Controllers\PortalController;
use App\Http\Controllers\PublicConfigController;
use App\Http\Controllers\RedirectController;
use App\Http\Controllers\StoreController;
use Illuminate\Support\Facades\Route;

// Lectures publiques du catalogue (appelées par la boutique Next depuis 127.0.0.1 : un seul compteur pour tous les visiteurs).
Route::middleware('throttle:1200,1,faw-catalog')->group(function () {
    Route::get('/', [StoreController::class, 'catalog']);
    Route::get('/catalog', [StoreController::class, 'catalog']);
    Route::get('/products', [StoreController::class, 'catalog']);
    Route::get('/products/{slug}', [StoreController::class, 'product']);
    Route::get('/categories', [StoreController::class, 'categories']);
});
// Devis et commandes : limites inchangées (120/min global + 10/min écriture, 30/min liens privés).
Route::middleware('throttle:120,1,faw-read')->group(function () {
    Route::middleware('throttle:10,1,faw-write')->group(function () {
        Route::post('/quotes', [StoreController::class, 'quote']);
        Route::post('/orders', [StoreController::class, 'submit']);
    });
    Route::get('/quotes/{token}', [StoreController::class, 'follow'])->middleware('throttle:30,1,faw-private');
    Route::get('/quotes/{token}/pdf', [StoreController::class, 'pdf'])->middleware('throttle:30,1,faw-private');
});
// Portail client sur le lien privé (sans compte) : lecture GET, actions POST explicites, limites par devis dans QuotePortal.
Route::middleware('throttle:120,1,faw-portal')->prefix('portal/{token}')->where(['token' => '[A-Za-z0-9_-]{32}'])->group(function () {
    Route::get('/', [PortalController::class, 'show']);
    Route::post('/otp', [PortalController::class, 'otp']);
    Route::post('/accept', [PortalController::class, 'accept']);
    Route::post('/refuse', [PortalController::class, 'refuse']);
    Route::post('/modification', [PortalController::class, 'modification']);
    Route::post('/payments/{payment}/proof', [PortalController::class, 'proof'])->whereNumber('payment');
});
Route::post('/cart', [CompatibilityController::class, 'cart'])->middleware('throttle:120,10,faw-cart');
Route::post('/t', [CompatibilityController::class, 'event'])->middleware('throttle:240,10,faw-events');
Route::post('/newsletter', [CompatibilityController::class, 'newsletter'])->middleware('throttle:8,10,faw-newsletter');

Route::post('/coupons/check', [StoreController::class, 'coupon'])->middleware('throttle:30,1,faw-coupon');
Route::get('/redirects/resolve', [RedirectController::class, 'resolve'])->middleware('throttle:300,1,faw-redirects');
Route::get('/catalogue.pdf', CatalogPdfController::class)->middleware('throttle:10,1,faw-catalog-pdf');

Route::get('/content/{kind}/{slug}', [ContentController::class, 'show'])->middleware('throttle:120,1,faw-content');
Route::get('/blog', [ContentController::class, 'posts'])->middleware('throttle:120,1,faw-content');
Route::get('/blog-taxonomies', [ContentController::class, 'taxonomies'])->middleware('throttle:120,1,faw-content');
Route::post('/contacts', [InboxController::class, 'submit'])->middleware('throttle:8,10,faw-inbox');

Route::get('/site-config', PublicConfigController::class)->middleware('throttle:300,1,faw-config');

Route::get('/content-links', [ContentController::class, 'links'])->middleware('throttle:120,1,faw-content');

// Card-provider notifications: 503 while no provider is enabled (card payment is not offered).
Route::post('/payments/webhook/{provider}', PaymentWebhookController::class)->middleware('throttle:60,1,faw-payment-webhook')->where('provider', '[a-z_]{2,32}');

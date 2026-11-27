<?php

use App\Http\Controllers\CatalogPdfController;
use App\Http\Controllers\CmiController;
use App\Http\Controllers\CompatibilityController;
use App\Http\Controllers\ContentController;
use App\Http\Controllers\InboxController;
use App\Http\Controllers\PaymentWebhookController;
use App\Http\Controllers\PortalController;
use App\Http\Controllers\PublicConfigController;
use App\Http\Controllers\RedirectController;
use App\Http\Controllers\Shop\CheckoutController;
use App\Http\Controllers\Shop\ShopDataController;
use App\Http\Controllers\StoreController;
use Illuminate\Support\Facades\Route;

// Lectures publiques du catalogue (appelées par la boutique Next depuis 127.0.0.1 : un seul compteur pour tous les visiteurs).
Route::middleware('throttle:1200,1,faw-catalog')->group(function () {
    Route::get('/', [StoreController::class, 'catalog']);
    Route::get('/catalog', [StoreController::class, 'catalog']);
    Route::get('/products', [StoreController::class, 'catalog']);
    Route::get('/products/{slug}', [StoreController::class, 'product']);
    Route::get('/categories', [StoreController::class, 'categories']);
    // Boutique Next (lecture seule, aucun accès direct à la base côté Next) : merchandising et landing pages.
    Route::get('/shop/merch', [ShopDataController::class, 'merch']);
    Route::get('/shop/landings', [ShopDataController::class, 'landings']);
    Route::get('/shop/landings/{slug}', [ShopDataController::class, 'landing'])->where('slug', '[a-z0-9-]{1,60}');
});
// Pages privées de la boutique (jeton de devis / numéro de commande aléatoire) : jamais de liste, réponses no-store.
Route::middleware('throttle:120,1,faw-shop-private')->group(function () {
    Route::get('/shop/quotes/{token}', [ShopDataController::class, 'quote'])->where('token', '[A-Za-z0-9_-]{32}');
    Route::get('/shop/orders/{number}', [ShopDataController::class, 'order'])->where('number', 'FAW-[0-9]{6}-[0-9A-F]{32}');
});
Route::post('/shop/coupons/check', [ShopDataController::class, 'coupon'])->middleware('throttle:60,1,faw-shop-coupon');
// Checkout : récapitulatif calculé par le serveur (panier, page commande ; appelé par le serveur Next pour tous les visiteurs).
Route::post('/shop/checkout/preview', [CheckoutController::class, 'preview'])->middleware('throttle:600,1,faw-shop-preview');
// Paiement d'une commande site, sur son numéro privé : justificatif de virement, formulaire CMI signé.
Route::middleware('throttle:20,1,faw-shop-payment')->where(['number' => 'FAW-[0-9]{6}-[0-9A-F]{32}'])->group(function () {
    Route::post('/shop/orders/{number}/proof', [CheckoutController::class, 'proof']);
    Route::get('/shop/orders/{number}/cmi', [CheckoutController::class, 'cmi']);
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
// Appelé par le middleware Next (cache mémoire de 60 s côté Next) : 600/min.
Route::get('/redirects/resolve', [RedirectController::class, 'resolve'])->middleware('throttle:600,1,faw-redirects');
Route::get('/catalogue.pdf', CatalogPdfController::class)->middleware('throttle:10,1,faw-catalog-pdf');

// Contenu public (CMS) : lu par la boutique Next depuis 127.0.0.1 (un compteur partagé par tous les visiteurs),
// mis en cache côté Next (revalidate + webhook) : 600/min laisse de la marge aux rafraîchissements simultanés.
Route::middleware('throttle:600,1,faw-content')->group(function () {
    Route::get('/content/{kind}/{slug}', [ContentController::class, 'show']);
    Route::get('/blog', [ContentController::class, 'posts']);
    Route::get('/blog-taxonomies', [ContentController::class, 'taxonomies']);
    Route::get('/content-links', [ContentController::class, 'links']);
    Route::get('/site', [ContentController::class, 'site']);
    Route::get('/home', [ContentController::class, 'home']);
});
Route::post('/contacts', [InboxController::class, 'submit'])->middleware('throttle:8,10,faw-inbox');

Route::get('/site-config', PublicConfigController::class)->middleware('throttle:300,1,faw-config');


// CMI : notification serveur signée (seule source de confirmation) et retour navigateur (redirection seulement).
Route::post('/payments/cmi/callback', [CmiController::class, 'callback'])->middleware('throttle:60,1,faw-cmi-callback');
Route::match(['get', 'post'], '/payments/cmi/return/{result}', [CmiController::class, 'back'])->middleware('throttle:60,1,faw-cmi-return')->where('result', 'ok|fail');

// Card-provider notifications: 503 while no provider is enabled (card payment is not offered).
Route::post('/payments/webhook/{provider}', PaymentWebhookController::class)->middleware('throttle:60,1,faw-payment-webhook')->where('provider', '[a-z_]{2,32}');

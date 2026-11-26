<?php

use App\Http\Controllers\InboxController;
use App\Models\Payment;
use App\Models\Quote;
use App\Models\QuoteVersion;
use App\Services\PaymentService;
use App\Services\QuoteService;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Storage;

Route::get('/admin/quotes/{quote}/pdf', function (Quote $quote, QuoteService $s) {
    abort_unless(auth()->user()?->canDo('view.quotes'), 403);

    return $s->pdf($quote);
})->middleware('auth')->name('admin.quote.pdf');

Route::get('/admin/quotes/{quote}/versions/{version}/pdf', function (Quote $quote, int $version, QuoteService $s) {
    abort_unless(auth()->user()?->canDo('view.quotes'), 403);

    return $s->versionPdf(QuoteVersion::where('quote_id', $quote->id)->where('version', $version)->firstOrFail());
})->middleware('auth')->whereNumber('version')->name('admin.quote.version.pdf');

// Bank-transfer proofs: private disk, finance / sales manager / super admin only, never cached.
Route::get('/admin/payments/{payment}/proof', function (Payment $payment) {
    abort_unless(PaymentService::canSchedule(auth()->user()) && $payment->proof_path, 403);
    $disk = Storage::disk('local');
    abort_unless($disk->exists($payment->proof_path), 404);

    return response($disk->get($payment->proof_path), 200, ['Content-Type' => $payment->proof_mime, 'Content-Disposition' => 'inline; filename="justificatif-'.$payment->reference.'.'.pathinfo($payment->proof_path, PATHINFO_EXTENSION).'"',
        'Cache-Control' => 'private, no-store', 'X-Content-Type-Options' => 'nosniff', 'Content-Security-Policy' => "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox"]);
})->middleware('auth')->whereNumber('payment')->name('admin.payment.proof');

Route::get('/admin/attachments/{id}/{index}', [InboxController::class, 'photo'])->middleware(['web', 'auth'])->name('faw.attachments');

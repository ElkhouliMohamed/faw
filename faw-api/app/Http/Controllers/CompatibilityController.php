<?php

namespace App\Http\Controllers;

use App\Models\InboxMessage;
use App\Services\QuoteService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

/** Keep the storefront's existing background requests working, without exposing extra admin modules. */
class CompatibilityController extends Controller
{
    protected function guard(Request $r, int $max): void
    {
        abort_if(strlen($r->getContent()) > $max, 413);
        abort_unless(in_array($r->header('origin'), config('cors.allowed_origins'), true), 403);
    }

    public function event(Request $r)
    {
        $this->guard($r, 2000);
        $v = $r->validate(['type' => ['required', Rule::in(['view', 'product_view', 'add_to_cart', 'whatsapp_click', 'checkout', 'quote_request', 'order'])], 'path' => ['nullable', 'string', 'max:200'], 'productId' => ['nullable', 'string', 'max:90'], 'source' => ['nullable', 'string', 'max:60'], 'medium' => ['nullable', 'string', 'max:60'], 'campaign' => ['nullable', 'string', 'max:100'], 'sid' => ['nullable', 'string', 'max:40']]);
        if (! in_array($v['type'], ['order', 'quote_request']) && ! str_starts_with($v['path'] ?? '', '/admin')) {
            DB::table('Event')->insert($v);
            if ($v['type'] === 'whatsapp_click') {
                InboxMessage::create(['kind' => 'whatsapp', 'name' => 'Visiteur du site', 'phone' => '', 'subject' => 'Clic WhatsApp — envoi non confirmé', 'message' => 'Un lien WhatsApp a été ouvert depuis '.($v['path'] ?? '/').'. Aucune conversation ni coordonnée client n’est confirmée.']);
            }
        }

        return response()->noContent()->header('Cache-Control', 'no-store');
    }

    public function cart(Request $r, QuoteService $service)
    {
        $this->guard($r, 6000);
        $v = $r->validate(['id' => ['required', 'regex:/^[a-z0-9]{16,40}$/'], 'items' => ['present', 'array', 'max:40'], 'items.*.id' => ['required', 'string', 'max:90'], 'items.*.qty' => ['required', 'integer', 'min:1', 'max:99'], 'name' => ['nullable', 'string', 'max:120'], 'phone' => ['nullable', 'regex:/^[+\d\s().-]{8,30}$/'], 'email' => ['nullable', 'email', 'max:160'], 'utmSource' => ['nullable', 'string', 'max:60'], 'utmCampaign' => ['nullable', 'string', 'max:100']]);
        $existing = DB::table('Cart')->where('id', $v['id'])->first();
        if ($existing?->status === 'récupéré') {
            return response()->noContent();
        }
        $priced = $service->price($v['items']);
        $data = ['items' => json_encode($v['items']), 'itemCount' => array_sum(array_column($v['items'], 'qty')), 'subtotal' => $priced['total'], 'updatedAt' => now()->getTimestampMs()];
        foreach (['name', 'phone', 'email', 'utmSource', 'utmCampaign'] as $field) {
            if (! empty($v[$field])) {
                $data[$field] = strip_tags($v[$field]);
            }
        }
        if ($existing) {
            DB::table('Cart')->where('id', $v['id'])->update($data);
        } else {
            DB::table('Cart')->insert(['id' => $v['id'], 'createdAt' => now()->getTimestampMs(), ...$data]);
        }

        return response()->noContent()->header('Cache-Control', 'no-store');
    }

    public function newsletter(Request $r)
    {
        $this->guard($r, 2000);
        $v = $r->validate(['email' => ['required', 'email', 'max:160'], 'consent' => ['required', 'accepted'], 'source' => ['nullable', 'regex:/^[\w:\/-]{0,60}$/'], 'website' => ['nullable', 'max:0']]);
        DB::table('NewsletterSubscriber')->updateOrInsert(['email' => mb_strtolower($v['email'])], ['consent' => true, 'source' => $v['source'] ?? 'popup']);

        return response()->json(['ok' => true])->header('Cache-Control', 'no-store');
    }
}

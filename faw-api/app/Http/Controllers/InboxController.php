<?php

namespace App\Http\Controllers;

use App\Models\Customer;
use App\Models\InboxMessage;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;

class InboxController extends Controller
{
    public function submit(Request $r)
    {
        $r->merge(['phone' => preg_replace('/[\s.()\-]/', '', (string) $r->input('phone'))]);
        $v = $r->validate(['kind' => ['required', Rule::in(['contact', 'bot', 'sav'])], 'name' => 'required|string|min:2|max:120', 'phone' => ['required', 'regex:/^(?:\+212|00212|0)[5-7]\d{8}$/'], 'email' => 'nullable|email|max:160', 'city' => 'nullable|string|max:80', 'subject' => 'required|string|max:200', 'message' => 'required|string|min:5|max:8000', 'productId' => 'nullable|string|exists:Product,id', 'website' => 'nullable|max:0', 'photos' => 'nullable|array|max:4', 'photos.*' => 'required|file|image|mimes:jpeg,png,webp|max:2048']);
        $paths = [];
        try {
            if ($v['kind'] === 'sav') {
                foreach ($r->file('photos', []) as $file) {
                    $paths[] = $file->store('sav', 'local');
                }
            }
            DB::transaction(function () use ($v, $paths) {
                $phone = preg_replace('/^(?:00212|\+212)/', '0', $v['phone']);
                $client = Customer::updateOrCreate(['phone' => $phone], ['name' => $v['name'], 'email' => $v['email'] ?? null, 'city' => $v['city'] ?? null, 'source' => 'site', 'lastActivityAt' => now()]);
                InboxMessage::create([...collect($v)->except(['website', 'photos'])->all(), 'contactId' => $client->id, 'photos' => $paths]);
            });
        } catch (\Throwable $e) {
            foreach ($paths as $path) {
                Storage::disk('local')->delete($path);
            }throw $e;
        }

        return response()->json(['ok' => true], 201);
    }

    public function photo(Request $r, int $id, int $index)
    {
        abort_unless($r->user()?->canDo('view.inbox'), 403);
        $m = InboxMessage::findOrFail($id);
        $path = $m->photos[$index] ?? null;
        abort_unless(is_string($path) && preg_match('#^sav/[a-zA-Z0-9]+\.(?:jpg|jpeg|png|webp)$#i', $path) && Storage::disk('local')->exists($path), 404);

        return response()->file(Storage::disk('local')->path($path), ['Cache-Control' => 'private, no-store', 'X-Content-Type-Options' => 'nosniff', 'Content-Security-Policy' => "default-src 'none'; sandbox"]);
    }
}

<?php

namespace App\Http\Controllers;

use App\Models\Redirect;
use Illuminate\Http\Request;

class RedirectController extends Controller
{
    public function resolve(Request $r)
    {
        $path = $r->validate(['path' => ['required', 'string', 'max:500']])['path'];
        if (preg_match('#^/(admin|api|livewire|devis)(/|$)#', $path)) {
            return response()->noContent();
        }$hit = Redirect::where('active', true)->where('from', $path)->first();
        if (! $hit) {
            return response()->noContent();
        }Redirect::whereKey($hit->id)->increment('hits');

        return response()->json(['to' => $hit->to, 'code' => (int) $hit->code])->header('Cache-Control', 'no-store');
    }
}

<?php

namespace App\Services;

use App\Models\Bundle;
use App\Models\Category;
use App\Models\Coupon;
use App\Models\FeeRule;
use App\Models\Product;
use App\Models\Promotion;
use App\Models\ShippingCity;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class CommerceService
{
    public function live($model): bool
    {
        return (! $model->startsAt || $model->startsAt <= now()) && (! $model->endsAt || $model->endsAt >= now());
    }

    public function productPrice(Product $p): array
    {
        $best = $p->price;
        $name = null;
        $slug = Category::where('label', $p->category)->value('slug');
        foreach (Promotion::where('active', true)->get() as $promo) {
            if (! $this->live($promo) || $promo->value <= 0) {
                continue;
            }
            $targets = array_filter(array_map('trim', explode(',', $promo->targets ?? '')));
            if ($promo->scope !== 'all' && ! ($promo->scope === 'product' && in_array($p->id, $targets)) && ! ($promo->scope === 'category' && in_array($slug, $targets))) {
                continue;
            }
            $price = max(1, $promo->kind === 'percent' ? (int) round($p->price * (100 - min(90, $promo->value)) / 100) : $p->price - $promo->value);
            if ($price < $best) {
                $best = $price;
                $name = $promo->name;
            }
        }

        return ['price' => $best, 'compareAt' => $best < $p->price ? $p->price : null, 'promoName' => $name];
    }

    public function validateBundle(Bundle $bundle): void
    {
        $items = is_array($bundle->items) ? $bundle->items : json_decode($bundle->items ?? '[]', true);
        if (! is_array($items) || ! array_is_list($items) || ! count($items) || count($items) > 20) {
            throw ValidationException::withMessages(['items' => 'Le pack doit contenir 1 à 20 références.']);
        }
        $bundle->items = $items;
        foreach ($items as $it) {
            if (! is_array($it) || ! isset($it['id'],$it['qty']) || ! is_int($it['qty']) || $it['qty'] < 1 || $it['qty'] > 99 || ! Product::whereKey($it['id'])->exists()) {
                throw ValidationException::withMessages(['items' => 'Référence ou quantité de pack invalide.']);
            }
        }
    }

    public function price(array $items, array $options = []): array
    {
        $expanded = [];
        $packs = [];
        $need = [];
        $reasons = [];
        $lines = [];
        foreach ($items as $it) {
            if (! isset($it['id'],$it['qty']) || ! is_numeric($it['qty']) || $it['qty'] < 1 || $it['qty'] > 10000) {
                throw ValidationException::withMessages(['items' => 'Quantité invalide.']);
            }
            if (str_starts_with($it['id'], 'pack:')) {
                $b = Bundle::where('slug', substr($it['id'], 5))->where('active', true)->first();
                if (! $b || $b->price <= 0) {
                    throw ValidationException::withMessages(['items' => 'Pack indisponible.']);
                }
                $this->validateBundle($b);
                $parts = $b->items;
                $packs[] = [$b, $it['qty'], $parts];
                foreach ($parts as $c) {
                    $need[$c['id']] = ($need[$c['id']] ?? 0) + $c['qty'] * $it['qty'];
                }
            } else {
                $expanded[$it['id']] = ($expanded[$it['id']] ?? 0) + $it['qty'];
                $need[$it['id']] = ($need[$it['id']] ?? 0) + $it['qty'];
            }
        }
        if (array_sum($need) > 10000) {
            throw ValidationException::withMessages(['items' => 'Quantité totale trop élevée.']);
        }
        $products = [];
        foreach ($need as $id => $qty) {
            $p = Product::find($id);
            if (! $p || ! $p->active) {
                throw ValidationException::withMessages(['items' => 'Produit inconnu ou désactivé.']);
            }$products[$id] = $p;
            if ($p->price <= 0 || $p->priceToConfirm) {
                $reasons[] = "$id : prix à confirmer";
            }
            if ($p->stockToConfirm || $p->availability !== 'en stock' || ($p->stockQty !== null && $p->stockQty < $qty)) {
                $reasons[] = "$id : stock à confirmer";
            }
            if ($id === 'EXT-CO2-2' && $qty >= 20) {
                $reasons[] = 'Tarif quantité à confirmer';
            }
            if (str_starts_with($id, 'AUTO-GBAT300') && ($options['kitLeaf'] ?? 0) > 2.5) {
                $reasons[] = 'Kit : vantail supérieur à 2,50 m';
            }
        }
        $note = $options['note'] ?? '';
        if (($options['custom'] ?? false) || preg_match('/sur[ -]?mesure|hors[ -]?standard|dimensions? sp[ée]ciales?/iu', $note)) {
            $reasons[] = 'Demande sur-mesure';
        }
        if (preg_match('/remise|r[ée]duc|rabais|ristourne|discount|promo|n[ée]goci|geste commercial|moins cher|dernier prix|meilleur prix|baisser? le prix|prix sp[ée]cial/iu', $note)) {
            $reasons[] = 'Demande de prix négocié : revue équipe requise';
        }
        $tierIds = ['CF-EI60-80', 'CF-EI60-90', 'CF-EI60-100'];
        $tierQty = array_sum(array_intersect_key($expanded, array_flip($tierIds)));
        foreach ($expanded as $id => $qty) {
            $p = $products[$id];
            $active = $this->productPrice($p);
            $unit = $active['price'];
            if ($tierQty >= 4 && in_array($id, $tierIds)) {
                $unit = min(2000, $unit);
            }$lines[] = $this->line($p, $qty, $unit, (bool) $active['compareAt']);
        }
        foreach ($packs as [$bundle,$packQty,$parts]) {
            // Allocate whole DH across individual units; compress equal unit prices afterwards. Totals stay exact for any component quantities.
            $units = [];
            $weight = 0;
            foreach ($parts as $c) {
                $p = $products[$c['id']];
                $unit = $this->productPrice($p)['price'];
                for ($i = 0; $i < $c['qty']; $i++) {
                    $units[] = ['p' => $p, 'weight' => max(1, $unit)];
                    $weight += max(1, $unit);
                }
            }
            $assigned = 0;
            foreach ($units as &$u) {
                $u['price'] = (int) floor($bundle->price * $u['weight'] / $weight);
                $assigned += $u['price'];
            }unset($u);
            $left = $bundle->price - $assigned;
            for ($i = 0; $i < $left; $i++) {
                $units[$i % count($units)]['price']++;
            }
            $grouped = [];
            foreach ($units as $u) {
                $key = $u['p']->id.':'.$u['price'];
                if (! isset($grouped[$key])) {
                    $grouped[$key] = $this->line($u['p'], 0, $u['price'], true);
                }$grouped[$key]['qty'] += $packQty;
                $grouped[$key]['total'] += $u['price'] * $packQty;
            }
            array_push($lines, ...array_values($grouped));
        }

        return ['lines' => $lines, 'total' => array_sum(array_column($lines, 'total')), 'reasons' => array_values(array_unique($reasons))];
    }

    protected function line(Product $p, int $qty, int $unit, bool $override): array
    {
        return ['id' => $p->id, 'title' => $p->title, 'category' => $p->category, 'qty' => $qty, 'unit' => $unit, 'total' => $unit * $qty, 'override' => $override];
    }

    public function coupon(string $code, int $subtotal, bool $consume = false): array
    {
        $c = Coupon::where('code', strtoupper(trim($code)))->where('active', true)->first();
        if (! $c || ! $this->live($c) || $c->value <= 0 || $subtotal < $c->minOrder || ($c->usageLimit !== null && $c->usedCount >= $c->usageLimit)) {
            throw ValidationException::withMessages(['coupon' => 'Code promo invalide, expiré ou épuisé.']);
        }
        $discount = min($subtotal, $c->kind === 'percent' ? (int) round($subtotal * min(90, $c->value) / 100) : $c->value);
        if ($consume) {
            $query = Coupon::whereKey($c->id)->where('active', true);
            if ($c->usageLimit !== null) {
                $query->where('usedCount', '<', $c->usageLimit);
            }if ($query->increment('usedCount') !== 1) {
                throw ValidationException::withMessages(['coupon' => 'Code promo épuisé.']);
            }
        }

        return ['code' => $c->code, 'discount' => $discount];
    }

    public function shipping(array $lines, string $mode): array
    {
        $families = [];
        $items = [];
        foreach ($lines as $l) {
            $cat = Category::where('label', $l['category'])->first();
            $families[] = $cat?->family ?? 'incendie';
            $items[] = ['id' => $l['id'], 'category' => $cat?->slug, 'family' => $cat?->family ?? 'incendie'];
        }
        $doors = in_array('portes-coupe-feu', $families);
        $kitOnly = count($families) > 0 && count(array_unique($families)) === 1 && $families[0] === 'automatisme';
        $cities = ShippingCity::where('active', true)->where('available', true)->get();
        $allowed = $doors ? [...$cities->pluck('slug')->all(), 'autre', 'retrait'] : ($kitOnly ? ['transporteur'] : [...$cities->pluck('slug')->all(), 'livraison', 'retrait']);
        if (! in_array($mode, $allowed, true)) {
            throw ValidationException::withMessages(['deliveryMode' => 'Mode de livraison non disponible.']);
        }
        $city = $cities->firstWhere('slug', $mode);
        $fee = 0;
        $unknown = false;
        if ($mode !== 'retrait') {
            foreach ($items as $item) {
                $rule = $this->feeRule($item, $city?->slug ?? '');
                if ($rule) {
                    if ($rule->mode === 'devis') {
                        $unknown = true;
                    } else {
                        $fee = max($fee, $rule->fee);
                    }
                } elseif ($city && $item['family'] === 'portes-coupe-feu') {
                    if ($city->fee === null) {
                        $unknown = true;
                    } else {
                        $fee = max($fee, $city->fee);
                    }
                }
            }
        }
        $label = match ($mode) {
            'retrait' => 'Retrait gratuit au dépôt','transporteur' => 'Transporteur : frais payés à la réception',default => $city ? 'Livraison '.$city->name.($fee ? ' : '.$fee.' DH TTC' : ' : sur devis') : 'Livraison sur devis'
        };
        if ($unknown) {
            $label .= ' · Complément transport à confirmer';
        }

        return ['fee' => $fee, 'label' => $label.' · Pose non comprise', 'kitOnly' => $kitOnly];
    }

    protected function feeRule(array $item, string $city): ?FeeRule
    {
        foreach ([['product', $item['id']], ['category', $item['category']]] as [$scope,$target]) {
            $rules = FeeRule::where('active', true)->where('scope', $scope)->where('target', $target)->whereIn('citySlug', [$city, ''])->get();
            if ($rule = $rules->firstWhere('citySlug', $city) ?? $rules->firstWhere('citySlug', '')) {
                return $rule;
            }
        }

        return null;
    }

    public function quoteTransport(array $lines, string $city, bool $pickup): array
    {
        if ($pickup) {
            return ['input' => ['mode' => 'retrait'], 'label' => 'Retrait au dépôt (gratuit)'];
        }
        $slug = Str::slug($city);
        if ($slug === 'casa') {
            $slug = 'casablanca';
        }
        $c = ShippingCity::where('active', true)->where('available', true)->where('slug', $slug)->first();
        if (! $c) {
            return ['input' => ['mode' => 'a_confirmer', 'ville' => $city], 'label' => $city.' : transport à confirmer, hors total'];
        }
        // Quote transport is always an option outside the quote total; configured fee exceptions apply to the same real components.
        $fee = 0;
        $unknown = false;
        foreach ($lines as $line) {
            $cat = Category::where('label', $line['category'])->first();
            $rule = $this->feeRule(['id' => $line['id'], 'category' => $cat?->slug], $c->slug);
            if ($rule) {
                if ($rule->mode === 'devis') {
                    $unknown = true;
                } else {
                    $fee = max($fee, $rule->fee);
                }
            } elseif ($c->fee === null) {
                $unknown = true;
            } else {
                $fee = max($fee, $c->fee);
            }
        }
        if ($unknown || $fee <= 0) {
            return ['input' => ['mode' => 'a_confirmer', 'ville' => $city], 'label' => $city.' : transport à confirmer, hors total'];
        }

        return ['input' => ['mode' => 'option', 'ville' => $c->name, 'montant' => $fee], 'label' => $c->name.' : '.$fee.' DH TTC en option, hors total'];
    }
}

<x-filament-panels::page>
<x-filament::section heading="Catalogue client à jour">
<p>Produits actifs, catégories, caractéristiques et prix actifs TTC. Aucun prix interne. Pose non comprise, illustration non contractuelle.</p>
<p class="mt-3">{{ \App\Models\Product::where('active',true)->count() }} références actives.</p>
<x-filament::button class="mt-4" tag="a" href="/api/catalogue.pdf" target="_blank">Télécharger le PDF</x-filament::button>
</x-filament::section>
</x-filament-panels::page>

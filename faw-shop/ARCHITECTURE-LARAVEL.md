# Séparation Next.js / Laravel

La boutique Next (`faw-shop`) est un **pur front** : elle ne lit aucune base de données et lit toutes ses données par l'API Laravel. Le seul back-office est **Filament**, à `/admin`, relayé vers Laravel avec ses assets et Livewire. L'ancien back-office Next a été supprimé.

- Laravel : `faw-api`, API locale `http://127.0.0.1:8000` (PostgreSQL).
- Next : `http://localhost:3100`.
- `LARAVEL_ORIGIN` : origine interne pour les appels SSR, les Server Actions et les rewrites (`/admin`, `/api`, `/livewire`, `/storage`, assets Filament) ; mettre aussi la valeur au build.
- Aucune variable de base de données côté Next (plus de Prisma, plus de `DATABASE_URL` ni `LARAVEL_DATABASE_URL`).

## Données lues par la boutique

| Besoin | Endpoint Laravel |
| --- | --- |
| Catalogue, fiche produit (prix actif, promotions, disponibilité) | `GET /api/catalog`, `GET /api/products/{slug}` |
| Catégories, badges, garanties, attributs, packs, popups, villes et frais de livraison | `GET /api/shop/merch` |
| Landing pages `/l/{slug}` et sitemap | `GET /api/shop/landings/{slug}`, `GET /api/shop/landings` |
| Pages, technologies, blog | `GET /api/content/{kind}/{slug}`, `GET /api/blog`, `GET /api/content-links` |
| Réglages publics (prix visibles, thème, SEO, GA4, Pixel, réseaux) | `GET /api/site-config` |
| Redirections SEO | `GET /api/redirects/resolve` (middleware) |
| Devis : dépôt, page privée, PDF, portail client | `POST /api/quotes`, `GET /api/shop/quotes/{token}`, `GET /api/quotes/{token}/pdf`, `/api/portal/{token}/…` |
| Commande : dépôt, confirmation | `POST /api/orders`, `GET /api/shop/orders/{number}` |
| Code promo du panier | `POST /api/shop/coupons/check` |
| Panier abandonné, mesure d'audience, newsletter (appelés par le navigateur via le relais `/api`) | `POST /api/cart`, `POST /api/t`, `POST /api/newsletter` |

Règles de confidentialité :

- Quand les prix publics sont désactivés (Filament), Laravel retire lui-même les montants (produits, packs, frais de livraison, textes).
- La page privée d'un devis n'est accessible que par son jeton (lien actif, non révoqué, non expiré) ; les montants ne sont renvoyés qu'après validation par l'équipe.
- La confirmation de commande n'accepte que le numéro aléatoire complet (`FAW-AAMMJJ-` + 32 caractères hexadécimaux) et seulement pendant 30 jours.
- Les liens privés (`/devis/suivi|pdf|confirmation`, `/commande/confirmation`) sont limités en débit par IP dans le middleware Next, en `no-store` et `noindex`.

Procédure complète, imports, modules livrés, règles devis et limites : `faw-api/README.md`.

Vérification HTTP : `bash scripts/run-http-integration.sh`, après le build Next, API principale disponible et ports de test 8001/3101 libres. Catalogue synthétique en `/tmp`, aucun vrai compteur/journal appelé, aucun email. Les services de test sont arrêtés à la fin.

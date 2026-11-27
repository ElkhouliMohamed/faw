# FAW v2 rebuild — plan and handoff

This file lets any coding agent (Claude Code, Antigravity, …) continue the FAW Aluminium v2 rebuild where the previous one stopped. Read it fully before changing code.

## Goal

Turn faw.ma (B2B aluminium, fire doors, automation — Casablanca, Morocco) from a showcase site into a CMS-driven B2B e-shop:

- `faw-api/` — Laravel 12 + Filament 4: API + the **only** back office (`/admin`).
- `faw-shop/` — Next.js 15 storefront. Reads **everything** through the Laravel API (no database access).

## Fixed decisions (do not revisit)

- **Database:** PostgreSQL everywhere. Local dev via the root `docker-compose.yml` (Postgres 17 on host port **5433**, Redis, Mailpit SMTP 1025 / UI 8025).
- **Pricing: hybrid.** Standard products show a price and can be bought online. Products marked "sur devis" (custom, made-to-measure, large B2B) show "Demander un devis". The cart can be turned into a quote request. The global "prices hidden" setting stays as a master switch (hidden → everything is quote mode).
- **Payments:** bank transfer (RIB + proof upload), cash on delivery / pickup, CMI card. **CMI stays disabled by default** until the owner enables and configures it in Filament.
- **Back office:** Filament only, full-page create/edit/view screens (no modals). The old Next admin is deleted.
- **Languages:** French + Arabic (RTL).
- **Currency:** MAD, TTC with TVA 20%, HT shown for B2B.

## Status

| Phase | Content | Status | Commit |
|---|---|---|---|
| 1 | PostgreSQL + Docker dev stack; shop API-only; old Next admin and Prisma removed; `faw:import-sqlite` command | ✅ done | `8430798` |
| 2 | Filament full-page CRUD (42 resources); orders + quotes kanban; KPI dashboard | ✅ done | `36f1113` |
| 3 | Hybrid e-commerce (price mode, cart, checkout, payments, quote request); CMS-driven home/menus; responsive; caching + revalidation | ✅ done | `e05bf6a` |
| 4 | FR/AR i18n with RTL; translatable content in Filament | ✅ done | `7cd8ab3` |
| 5 | Local SEO Casablanca/Morocco; Google Tag Manager; Meta Pixel | ✅ done | `8674893` |
| 6 | Claude-powered AI helper in Filament (products, blog posts) | ✅ done | `b75ac03` |

Update this table (status + commit hash) at the end of every phase.

## How to resume a phase that was interrupted

1. `git branch --show-current` must print `rebuild/v2`. Never work on `main`.
2. `git status` and `git diff --stat`. Uncommitted changes are the partial work of the interrupted phase. **Keep what is correct, finish what is incomplete** — do not redo finished work from scratch, and do not `git checkout .` / `git reset --hard`.
3. Read the phase spec below, compare it with the diff, finish the missing parts.
4. Run the checks under **Definition of done**, then commit the phase (one commit per phase).

## Local setup

See `DEV-SETUP.md`. Short version (Windows, Git Bash):

```bash
docker compose up -d                       # postgres:5433, redis, mailpit
cd faw-api && composer install && php artisan migrate && cd ..
cd faw-shop && npm ci && cd ..
```

Run the apps: `php artisan serve` (faw-api, port 8000) and `npm run build && npm run start -- -p 3101` (faw-shop; port 3100 may be taken by another local project). Set `LARAVEL_ORIGIN=http://127.0.0.1:8000` in `faw-shop/.env.local`.

## Tests (the gate)

On plain Windows ~34 faw-api tests fail for Windows-only reasons (`/tmp` paths, chmod, `python3`). The real gate is the **Linux container**:

```bash
docker build -t faw-api-test:local docker/php-test        # once
# Git Bash on Windows: prefix with MSYS_NO_PATHCONV=1 and use "$(pwd -W)" instead of "$(pwd)"
docker run --rm --network faw_default \
  -v "$(pwd)/faw-api:/app" --tmpfs /app/bootstrap/cache:mode=1777 -w /app \
  -e DB_HOST=postgres -e DB_PORT=5432 -e DB_DATABASE=faw_test \
  faw-api-test:local php -d memory_limit=1G vendor/bin/phpunit
```

- Full suite ≈ 12 minutes; 130 tests passed after Phase 2. Run targeted tests while working (`--filter`), the full suite before committing.
- The test DB name must end in `_test` (see `app/Console/Commands/TestFixture.php`). Never run tests against `faw` (the dev DB).
- Shop: `cd faw-shop && npx tsc --noEmit && npm run lint && npm run build`.

## Definition of done (every phase)

- Full faw-api suite green in the Linux container.
- faw-shop: `tsc`, `lint`, `build` pass.
- The phase's flows checked by hand or with HTTP calls (pages return 200, no 500).
- A self-review of `git diff` for: money computed client-side, hidden/sur-devis prices leaking, IDOR on orders/quotes/carts, missing throttles, secrets in files, XSS (`dangerouslySetInnerHTML`, Blade `{!! !!}`).
- Commit on `rebuild/v2`: `Phase N: <summary>`. Do **not** push and do not touch the live VPS.

## Rules

- Keep existing security: throttles, private tokens, same-origin checks on server actions, honeypot/anti-spam, audit logging.
- Never put real secrets in files. `.env.example` values stay empty or clearly marked "local docker only".
- UI text in French for now (Arabic in Phase 4). Keep user-facing strings in pages/components or a dictionary, not buried in utils.
- Filament 4 APIs (`Filament\Schemas\Schema`, actions under `Filament\Actions`). When unsure, read `faw-api/vendor/filament`.
- Old shop timestamps are BIGINT epoch **milliseconds** (see the `ShopTimestamp` cast); new tables can use normal timestamps.
- Queries must be portable PostgreSQL (no SQLite-only functions; quote camelCase identifiers via the query builder).

## Phase specs

### Phase 3 — hybrid e-commerce, CMS front, responsive, fast

**Commerce flow (API + Filament + shop pages):**
1. Per-product price mode in Filament (Products › Prix & stock): "Achat en ligne" vs "Sur devis", optional max online quantity above which the cart suggests a quote. Never send prices for sur-devis products or when prices are globally hidden.
2. Product page: TTC + HT price, availability, quantity, "Ajouter au panier" + "Demander un devis", sticky add-to-cart on mobile.
3. Cart `/panier`: quantities, remove, coupon, shipping by city, HT/TVA/TTC totals, "Commander" and "Transformer en demande de devis".
4. Checkout `/commande`: contact (Moroccan phone, email, company + ICE optional), delivery city/address or pickup, only **enabled** payment methods, CGV checkbox. All totals recomputed server-side. Order created through the existing order code path (history, audit, emails). Confirmation per method (virement → RIB + proof upload; livraison → instructions; CMI → existing CMI flow).
5. Payment settings in Filament: enable virement / livraison (optional max amount, allowed cities) / CMI (default off, needs credentials).
6. Quote request `/devis`: from a product, from the cart, or blank; few fields; tracking link (existing token flow).
7. Tests for price exposure, order creation per payment method, COD limits, CMI hidden when off, cart→quote.

**Storefront CMS, responsive, performance:**
1. Home page sections editable in Filament (hero, featured categories/products, why FAW, client logos, testimonials, CTA devis, blog teaser) — ordered, toggleable; header/footer menus, contact info (phone, WhatsApp, email, address, hours), socials, theme colors/logo.
2. Mobile-first header with burger menu, sticky header, WhatsApp/phone quick buttons; check 360 / 768 / 1280 px.
3. Caching: replace blanket `cache: 'no-store'` with `revalidate` + tags for catalog/content; Laravel → Next on-demand revalidation webhook (secret header, timing-safe compare) when content changes in Filament. Private data (cart, orders, quotes) stays uncached. `next/image` everywhere, minimal client JS.

### Phase 4 — French / Arabic

- URL prefixes `/fr` (default) and `/ar`, `hreflang`, language switcher, `dir="rtl"` + RTL-aware layout (logical CSS properties / Tailwind `rtl:` variants), Arabic font.
- All UI strings in dictionaries (`fr`, `ar`).
- Translatable content in Filament: products, categories, blog posts, pages, home sections, menus, SEO fields (e.g. `spatie/laravel-translatable` or `_ar` columns — pick one, apply consistently). API returns the requested locale with French fallback.
- Emails and quote/order pages in the customer's language. Filament admin stays French.

### Phase 5 — SEO (Casablanca / Morocco) + tracking

- Structured data: `LocalBusiness` (address Casablanca, phone, hours, geo), `Organization`, `Product` + `Offer` (only for priced products), `BreadcrumbList`, `Article`, `FAQPage` where relevant.
- Metadata per page in FR/AR, canonical, `hreflang`, sitemap index with alternates, robots rules, clean slugs, 301s from old faw.ma URLs (redirects already exist).
- Local landing pages manageable in Filament (e.g. "porte coupe-feu Casablanca", "menuiserie aluminium Casablanca", cities in Morocco) without thin/duplicate content.
- Core Web Vitals: LCP image priority, no layout shift.
- **Google Tag Manager** container ID and **Meta Pixel** ID set in Filament (not in code), loaded only after cookie consent (consent banner already exists). dataLayer events: `view_item`, `add_to_cart`, `begin_checkout`, `purchase`, `generate_lead` (quote request), with the Pixel equivalents (`ViewContent`, `AddToCart`, `InitiateCheckout`, `Purchase`, `Lead`). No personal data in events.

### Phase 6 — AI helper (Claude)

- In Filament, on product and blog post edit pages: "Générer avec l'IA" actions — from a few notes/specs, draft the description, short description, SEO title/description, FAQ, and the Arabic translation; blog: outline → full article in FR and AR.
- Calls the Claude API from Laravel (server side only) with `ANTHROPIC_API_KEY` in `.env` (never in code or the browser). Use the current Claude model IDs from Anthropic's docs. Show a preview; the admin accepts/edits before saving. Log usage, rate-limit per user, handle errors and a missing key gracefully (button hidden or disabled with a message).
- Tests with the HTTP client faked (no real API calls in tests).

### Phase 7 — home page redesign from the client mockup (in progress)

Target: `docs/design/home-mockup.jpg`. The home page must look like the mockup and be **100% editable in Filament** (texts, images, icons, links, items, order, visibility — FR and AR).

- Extend `faw-api/app/Services/HomeSections.php` (do not create a parallel system): `heroSlider` (slides with eyebrow, title, text, image, 2 buttons, 3 badges, EI60/90/120 highlight), `features` (4 icon items), `products` (+ eyebrow), `sectors`, `about` (image, checklist, button), `highlights` (dark band with background image), `projects` (réalisations photos), `process` (numbered steps), `cta` (+ phone and WhatsApp). Old stored JSON must keep rendering.
- Icons from a curated lucide list (Select in Filament, whitelist validated server-side).
- Site-level settings: top bar items, header CTA, footer (description, socials, link columns, contact lines, hours, legal links).
- Filament: Builder blocks with French labels, image uploads, repeaters (reorder/collapse), per-section visibility; a seed/reset that reproduces the mockup texts.
- Next.js: one component per section in `components/home/`, only the slider is a client component; mobile-first, RTL-correct, `next/image`.
- Visual QA: Playwright screenshots of `/fr` (1440 and 390 px) and `/ar` compared with the mockup until they match.

## Needs the owner (not code)

- `ANTHROPIC_API_KEY` (Phase 6), GTM container ID and Meta Pixel ID (Phase 5) — entered in the server `.env` / Filament, never in chat or git.
- CMI merchant contract and credentials before enabling card payment.
- Production go-live: PostgreSQL on the VPS, `faw:import-sqlite` from the current SQLite file with the **same APP_KEY**, nginx/pm2 already set up (see the deployment notes), then switch.

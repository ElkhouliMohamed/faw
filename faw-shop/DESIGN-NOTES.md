# Notes de design – FAW v2 (références Awwwards)

Recherche du 21/10/2026 via les pages Awwwards (fiches « highlights », palettes, technos). Les sites eux-mêmes n'ont pas été
parcourus en direct depuis la machine (pas de navigateur interactif dans ce passage) : les motifs ci-dessous viennent des
éléments primés listés par Awwwards et sont réinterprétés, pas copiés.

| Site | Distinction | Ce que j'en ai retenu pour FAW |
|---|---|---|
| **Floema** – https://www.awwwards.com/sites/floema | SOTD 13/05/2026 · e-commerce | Palette réduite à 2 couleurs fortes (ici cuivre + brun quasi noir), zoom d'image piloté par le scroll (hero : image révélée par masque puis légère parallaxe), page produit très éditoriale. |
| **iyO** – https://www.awwwards.com/sites/iyo | SOTD 02/04/2026 · e-commerce | Fond quasi noir unique, slider produit horizontal, menu/panier « multi-états » → compteur de panier animé, vitrine horizontale des catégories. |
| **&Tradition** – https://www.awwwards.com/sites/tradition | SOTD · mobilier / architecture | Typographie comme élément principal, fiche produit avec bloc « spécifications » structuré → fiche technique en tableau monospace, colonne d'infos collante. |
| **Jonite** – https://www.awwwards.com/sites/jonite | SOTD · fabricant (pierre reconstituée) | Fabricant industriel traité en luxe : listes de catégories, page « solutions sur mesure », spécifications techniques → bloc B2B sur-mesure et fiches très lisibles. |
| **Knupfer Metallbau** – https://www.awwwards.com/sites/knupfer-metallbau | Honorable Mention · construction métallique | Hero plein cadre noir/blanc, animation de texte du footer au scroll → mot-symbole géant « FAW » en pied de page, sections numérotées. |
| **Belgrade Arbor** – https://www.awwwards.com/sites/belgrade-arbor | SOTD 17/10/2026 · architecture (Next.js) | Smooth scroll (→ Lenis, desktop uniquement), animation d'intro sobre, filtres soignés → barre de filtres collante en « pills ». |
| **Minimal Steel** – https://www.awwwards.com/sites/minimal-steel | Honorable Mention · acier | Noir + blanc + un seul accent chaud ; beaucoup d'espace blanc → accent cuivre réservé aux prix et aux CTA. |
| **Ferrumpipe** – https://www.awwwards.com/sites/ferrumpipe | SOTD (2020) · clôtures en acier galvanisé | Référence plus ancienne mais même secteur : animations déclenchées au scroll, menu overlay → révélations ligne par ligne, menu mobile plein écran. |

## Motifs appliqués
- Typographie éditoriale XXL (Be Vietnam Pro 800, interlignage serré), lignes révélées par masque.
- Image du hero révélée par `clip-path` puis parallaxe douce.
- Bandeau défilant (marquee) catégories / engagements documentés uniquement.
- Vitrine horizontale épinglée des 4 catégories (desktop) ; carrousel à accroche (scroll-snap) sur mobile.
- Grille produits asymétrique, zoom d'image + voile d'infos au survol.
- Manifeste révélé mot par mot au scroll, sections numérotées (01, 02…), libellés Fragment Mono.
- Boutons magnétiques et curseur personnalisé : desktop (pointeur fin) uniquement.
- Lenis : desktop uniquement ; tout est désactivé avec `prefers-reduced-motion`.
- Fiche produit : galerie verticale + colonne d'infos collante ; panier/demande avec étapes numérotées.

---

# v3 · « warm minimalist » (21/10/2026)

Demande du propriétaire : site minimaliste, lignes parfaites, couleurs plus chaudes, moins de noir, rien de criard ;
donner envie d'entrer, de défiler et d'ajouter au panier dès les 2 premières secondes.

## Palette (tokens `src/app/globals.css`)
| Rôle | Clair (défaut) | Sombre (chaud) |
|---|---|---|
| Fond | `#FBF4EA` crème | `#241811` brun profond |
| Surface / sable | `#F3E8D8` | `#33241A` |
| Carte | `#FEF9F2` | `#2A1D14` |
| Texte | `#382213` brun | `#F3E8D8` crème |
| Texte secondaire | `#6E5544` (6,3:1) | `#C9B59E` (8,7:1) |
| Accent cuivre (CTA, liens) | `#94582E` (5,2:1 sur crème, 4,7:1 sur sable ; texte crème dessus 5,2:1) | `#D9925A` (6,8:1) |
| Flamme | `#ED8838`, puces de 4 px uniquement | idem |
| Filet 1 px | `#E6D8C5` | `#3E2E23` |
Aucun `#000` ; l'ancien `--ink` vaut `#241811`. Le mode clair est le défaut (`defaultTheme="light"`).

## Système
- 2 familles : Be Vietnam Pro (latin, 400–700) + IBM Plex Sans Arabic (arabe). Inter et Fragment Mono retirés.
- Une échelle fluide : `text-d1` (36→64 px), `text-d2` (28→44), `text-d3` (20→24), `text-lead`, corps 16 px.
- `shell` (1440 px max, gouttières 16/32/48), `grid-12` (12 colonnes, gouttière 16/24/32), `section-y` (64/96), `hairline`.
- Un seul rayon `--radius: 8px` (toutes les variantes shadcn pointent dessus). Boutons `btn` 48 px (`btn-primary`, `btn-ghost`).
- Retirés : Lenis, curseur, boutons magnétiques, marquee, vitrine épinglée, parallaxes, masques clip-path, révélation mot à mot,
  fonds « blueprint », halos flous. Framer Motion n'est plus importé côté boutique.
- Révélations : CSS seul (`.reveal`, scroll-driven `animation-timeline: view()`, opacité + 16 px), désactivées si « réduire les animations ».

## Intro (accueil, 1re visite de la session)
Script inline exécuté avant le 1er rendu → `html[data-intro="play"]` si `sessionStorage` vide et pas de `prefers-reduced-motion`.
Calque fixe au-dessus du hero déjà rendu (pas de blocage du LCP) : logo officiel, filet cuivre, « Protéger, sans renoncer au design. »,
sous-ligne factuelle. Rideau qui se lève de 1,5 à 2,0 s (CSS pur). « Passer » / clic / touche = fondu 0,25 s. Jamais sur les autres pages.

## Conversion
Hero : un produit vedette (CF-EI60-140-2V, photo réelle) avec prix « X DH TTC », « Pose non comprise », ajout direct au panier.
Cartes : prix visible + bouton « Ajouter » (quantité 1). Fiche produit mobile : barre d'achat collante tant que le bloc d'achat n'est pas à l'écran.

# v6 · couleurs du logo, packshots, fiches produit complètes (10/11/2026)

## Palette (tokens `src/app/globals.css`, couleurs prélevées dans `public/brand/logo-faw.png`)
| Rôle | Clair | Sombre |
|---|---|---|
| Fond / cartes | `#FFFFFF` | `#1C120A` / `#26190E` |
| Surface « lin » (fonds d'images) | `#F5F1EB` | `#2E2013` |
| Texte (brun du logo) | `#432A13` | `#F7EFE6` |
| Texte secondaire | `#6B5443` (7,1:1) | `#C9B8A6` |
| Orange du logo (boutons, puces) | `#F38F26`, texte `#2B1A0B` dessus (7,0:1) | `#F5A04A` |
| Orange texte (liens, sur-titres) | `#B4530A` (5,0:1 sur blanc) | `#F7B36B` |
| Bandeaux / pied de page | `#432A13`, texte `#FBF3E8` | `#120B05` |
| Filet | `#ECE4DA` | `#3A2A1C` |
Rayon unique 12 px. Back-office Filament : primaire `#F38F26`, gris Stone, logo officiel, cartes plates à filet (`resources/views/filament/faw-theme.blade.php`).

## Sources d'inspiration (aucun code ni visuel de marque copié, sauf le prompt gratuit Glacier adapté)
- Hero : prompt gratuit « Glacier » de Scrolltide (https://www.scrolltide.co/templates/glacier) — composition centrée type affiche, titre 2 lignes léger/gras, bouton ovale, barre basse « Défiler ». Adapté : polices du site (pas de Playfair), fond WebGL au lieu d'une vidéo, texte FAW factuel, produit vedette avec prix juste dessous, animations CSS coupées si « réduire les animations ».
- Fond animé : `src/components/ember-shader.tsx`, shader écrit pour FAW d'après les familles « Grain Gradients / Mesh » de https://scrollshaders.com (leur code est payant : rien n'a été copié). Boucle 12 s, pause hors écran, DPR ≤ 1,5, image fixe si mouvement réduit, dégradé CSS de secours.
- Fiches, cartes, filtres : style « Brex — White concrete, single ember » sur https://styles.refero.design (toile blanche, un seul accent orange, cartes plates à filet, pied de page sombre en serre-livre).
- Pied de page : galerie https://footer.design (ex. Lantern, choix de la rédaction) — colonnes structurées + mot-symbole géant.
- Appels à l'action : https://cta.gallery catégorie « Call-to-Buy » — bandeau devis + WhatsApp sur la fiche, 3 chemins (WhatsApp / devis / appel) en pied de page.

## Images
`python3 scripts/packshots.py` : détourage (rembg isnet, sauf porte 1 vantail déjà détourée), sujet centré sur fond lin 1200×1500 (4:5), ombre de contact. Sortie `public/images/products/v6/` (nouvelles URL = pas de cache périmé). Originaux : `assets/photos-originales/`. Galandage : photo d'ambiance recadrée 4:5.

## Fiche produit
Fil d'Ariane, galerie, bloc d'achat collant (taille, ajout panier, devis, WhatsApp, repères de confiance), sommaire collant, sections H2 : Détails · Caractéristiques · Guide d'installation (étapes du back-office, sinon « À vérifier avant la pose » tiré des données) · Fiche technique (seulement si un PDF existe) · Options · Questions, puis bandeau devis et produits liés.
Champs Laravel `details`, `installationGuide`, `datasheet` (PDF ≤ 4 Mo, section « Fiche produit » du formulaire). `php artisan faw:product-content` complète les détails vides à partir des faits du catalogue (jamais d'écrasement).
Vérifications : `python3 scripts/check-v6.py [BASE]` ; captures `node scripts/shots-v6.mjs` → `shots/v6/`.

## v7 — hero fonctionnel (remplace l'affiche v6)
- Plus d'affiche plein écran ni de shader WebGL (ember-shader supprimé, CSS settle/btn-oval/hero-shader retirée).
- Colonne gauche : sur-titre, H1 unique couvrant la gamme (« Portes coupe-feu, galandage et matériel incendie à Casablanca »),
  phrase factuelle, recherche GET /produits?q=, actions Boutique / Devis PDF en ligne / WhatsApp.
- Colonne droite : 4 tuiles catégories (photo produit réelle, « dès X DH TTC » = prix minimum du catalogue), id #collections ;
  l'ancienne section catégories en double est supprimée.
- Rendu serveur, aucune animation obligatoire (zoom au survol coupé par prefers-reduced-motion).
- Langue : ?lang=ar|fr fixe le cookie (middleware) ; le bouton retire ?lang et recharge (scripts/check-locale-toggle.mjs).

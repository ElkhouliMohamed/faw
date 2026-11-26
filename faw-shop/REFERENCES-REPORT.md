# Rapport de références concurrentes – boutique FAW Aluminium

Étude du 31/10/2026 (heure de Casablanca). **Inspiration uniquement** : aucun texte, aucune photo, aucun logo ni élément de marque
des sites étudiés ne doit être repris. Les observations ci-dessous sont des constats de structure, reformulés.

Méthode : HTML brut (curl), analyse des balises `<title>`, Hn, JSON-LD, formulaires ; captures Chrome sans interface
1440 px (bureau) et iPhone 13 (mobile) dans `/workspace/refs/shots/` (sur la box, hors du projet).

## 0. Accessibilité des sites demandés

| Site | État le 31/10/2026 | Conséquence |
|---|---|---|
| makrodoor.ma | En ligne (WordPress 6.8 + WooCommerce + WPBakery) | Étudié en détail (accueil, porte coupe-feu, gamme, contact, catalogue, panier) |
| padilla.ma | **Le domaine ne répond pas** (DNS introuvable via Firecrawl, erreur 500 via WebFetch/curl, aucune archive Wayback) | Non étudiable. Les annuaires indiquent que la société marocaine utilise plutôt padillamaroc.com, lui aussi injoignable aujourd'hui (archive 2023 = simple redirection) |
| expertincendie.com | **Le domaine ne répond pas** (DNS). Les archives 2025 montrent un site WordPress de **colloque québécois d'expertise judiciaire incendie** (conférenciers, horaire, FAQ) | Hors sujet : ni boutique ni Maroc |
| expertincendie.ma | **N'existe pas** (DNS introuvable, aucune archive) | – |

→ Seul makrodoor.ma est une vraie référence exploitable. Pour les sections 2–5 des deux autres, voir le § 4 (constats
indirects et alternatives proposées).

---

## 1. makrodoor.ma

### 1.1 Structure et navigation
- En-tête noir collant : logo, 4 liens (Accueil, Équipement de quai, Menuiserie métallique, À propos, Contact), icônes
  LinkedIn / YouTube / WhatsApp / téléphone, icône panier, puis menu « burger » plein écran avec **~30 entrées** (chaque gamme
  et chaque modèle). Navigation lourde : la porte coupe-feu n'est qu'une entrée parmi 30.
- Accueil : carrousel plein écran (une diapositive par famille, 2 CTA « En savoir plus » / « Demandez votre devis »),
  bloc « qui sommes-nous » avec photo d'équipe sur chantier, grilles de familles, articles de blog bilingues FR/EN.
- Pages « famille » (ex. `/porte-coupe-feu/`) et pages « modèle » (ex. `/active-roll/`), blog, page catalogue PDF
  (formulaire), contact. Sélecteur de langue flottant (Google Translate), bouton WhatsApp flottant en bas à droite.
- Le panier WooCommerce existe dans l'en-tête mais `/panier/` affiche une page « bientôt » : **aucun prix, aucune vente en ligne**.

### 1.2 Pages produit
- **Une page par famille, plusieurs produits empilés** : H1 = nom de la famille (« Porte coupe feu »), sous-titre slogan,
  fil d'Ariane, puis un bloc par type (battante, coulissante, rideau métallique, rideau textile) : petit sur-titre
  « … au Maroc » (mot-clé local), H2 = type, paragraphe générique, une ligne « Résistance au feu de 60 à 120 min »,
  lien « Télécharger la fiche technique », mention « contactez le service commercial », 3–5 photos d'ambiance.
- **Pas de variantes de dimensions**, pas de tableau de spécifications (dimensions, vantaux, finition, quincaillerie),
  pas de photo par taille, **pas de prix**, pas d'ajout au panier. Seul CTA : « Demandez votre devis gratuit » → `/contact`.
- Pages modèle (ex. porte rapide) : H1 = nom commercial seul, 2 H2 identiques ; texte d'avantages en liste.
- Images : textes alternatifs = noms de fichiers d'origine en langue étrangère, pas descriptifs.

### 1.3 Formulaire devis / B2B
- Un seul formulaire générique (Contact Form 7 + reCAPTCHA) : Nom et prénom*, **Société*** (obligatoire), e-mail*,
  téléphone*, Objet* (Devis / Prise de contact / Réclamation / Autre), Produits* (texte libre), Message*, case CGU.
  **7 champs obligatoires**, pas d'ICE, pas de quantité, pas de dimensions, pas de ville du chantier, pas de pièce jointe
  (plan), pas de préremplissage depuis la page produit.
- Formulaire « catalogue » : prénom, e-mail, téléphone, société → téléchargement du PDF (capture de prospect).
- Chargement mesuré : 1,0–1,3 s (bureau) / 1,3–1,5 s (mobile) pour les pages internes, 2,6–2,8 s pour l'accueil.

### 1.4 Confiance, réseaux, chat
- Photo d'équipe en tenue sur chantier (fort signal de sérieux), blog technique, catalogue téléchargeable.
- Icônes LinkedIn, YouTube, WhatsApp, téléphone dans l'en-tête ; Instagram et Facebook dans le pied de page.
- Bouton WhatsApp flottant (lien `wa.me`) ; script de chat Crisp présent dans le code mais pas de fenêtre visible lors du test.
- Absents : avis clients, références de chantiers chiffrées, certificats visibles, adresse/plan sur les pages produit,
  délais, garanties.

### 1.5 SEO
- Titles orientés mot-clé + géographie : « Fournisseur de porte coupe feu maroc », « Fournisseur et installateur de porte
  sectionnelle maroc ». Meta descriptions présentes sur les familles, absentes sur contact/catalogue.
- JSON-LD Yoast : WebSite, WebPage, Organization, BreadcrumbList, SearchAction. **Pas de Product, Offer, FAQPage ni
  LocalBusiness.**
- Défauts : 2 H1 sur certaines pages, H2 répétés, `og:locale` en_US sur un site français, pages « doublons » en anglais
  (« Fire door Morocco ») au contenu mince, pas de hreflang.

### 1.6 À adopter / à faire mieux
- **Adopter** : pages famille ciblant « porte coupe-feu Maroc / Casablanca » ; sur-titre local ; fiche technique PDF
  téléchargeable ; photo d'équipe ou de pose réelle ; WhatsApp visible dans l'en-tête et en flottant ; champ Société.
- **Faire mieux** : prix TTC affichés (FAW le fait déjà), variantes de dimensions avec photo, tableau de spécifications,
  devis court prérempli, ICE facultatif, schema Product + Offer + FAQ, un seul H1, alt descriptifs en français, pas de
  pages anglaises minces.

---

## 2. padilla.ma – non accessible
Rien d'observable en ligne ni en archive. Ce que l'on sait par les annuaires publics (fiche entreprise, ICE affiché sur
des annuaires B2B) : spécialiste des portes coupe-feu et portes techniques à Casablanca, contact surtout par téléphone.
Leçon indirecte : sur ce marché, **l'ICE et la raison sociale sont des signaux de confiance publics** ; FAW peut afficher
les siens en pied de page.

## 3. expertincendie.com / .ma – non accessibles, hors sujet
`.com` = ancien site de colloque d'expertise incendie (Québec), `.ma` inexistant. Rien à transposer. Alternative utile
repérée lors de la recherche (non étudiée en profondeur, à valider) : les sites marocains d'extincteurs mettent en avant
« devis en 1 minute envoyé sur WhatsApp », FAQ « quel extincteur pour quel feu », formats disponibles par type
(2/6/9 kg) et zones desservies – des motifs pertinents pour la catégorie Incendie de FAW.

---

## 4. Synthèse par critère (comparaison avec la boutique FAW actuelle)

| Critère | makrodoor.ma | FAW aujourd'hui | Écart à combler |
|---|---|---|---|
| Prix | Aucun | Prix DH TTC visibles, « Pose non comprise » | Avantage FAW, à garder |
| Panier / commande | Panier vide | Panier + demande de commande (virement, chèque, paiement à la réception) | Avantage FAW |
| Variantes de taille | Aucune | 1 fiche par taille (10 portes EI60, 5 galandages) | Ajouter un sélecteur de largeur entre fiches sœurs |
| Spécifications | 1 ligne | Description en texte | Tableau de specs structuré |
| Fiche technique | PDF par type | Absente | PDF FAW (sans nom de fabricant) |
| Devis B2B | Formulaire générique 7 champs | Champs Société + ICE au checkout ; devis grande quantité via WhatsApp | Formulaire devis court et prérempli |
| Confiance | Photo d'équipe, blog, réseaux | WhatsApp flottant, adresse de retrait | Photos de pose, chantiers, réseaux sociaux |
| Schema | Organization, Breadcrumb | Product + Offer | Ajouter Organization/LocalBusiness, BreadcrumbList, FAQPage |
| H1 / title | Courts, mot-clé + Maroc | H1 = `seoTitle` complet (~100 caractères) | Title ≤ 60 caractères, H1 court + ligne de specs |

---

## 5. Checklist priorisée pour `/workspace/faw-shop` (12 points max)

Règles FAW rappelées : ne jamais nommer de fournisseur ni de fabricant, pas de prix d'achat, jamais le terme interdit pour
les portes, pas de paiement par carte ni de crédit.

1. **Raccourcir les titles produit** (≤ 60 caractères, ex. « Porte coupe-feu EI60 90 cm 1 vantail – Casablanca ») et
   séparer le H1 (court) d'une ligne de specs sous le H1 ; aujourd'hui H1 = `seoTitle` de ~100 caractères
   (`src/app/produits/[slug]/page.tsx`, champ `seoTitle` de `data/products.json`).
2. **Sélecteur de largeur** sur les fiches porte coupe-feu et galandage : pastilles 80/90/100/… qui renvoient vers la fiche
   sœur (URL et prix propres conservés), avec la photo de chaque taille et le prix TTC qui change.
3. **Tableau de spécifications** structuré (résistance EI60, dimensions passage/hors-tout, vantaux, matériau, isolant,
   finition, quincaillerie incluse, sens d'ouverture, délai) à la place du paragraphe unique.
4. **Formulaire « Demander un devis » court** (≤ 5 champs visibles : nom, téléphone, ville du chantier, quantité, produit
   prérempli ; Société / ICE / e-mail / plan PDF en « options pro » repliées), avec envoi vers le CRM existant et
   bouton « continuer sur WhatsApp » au même endroit.
5. **Pages catégorie indexables** (`/produits/portes-coupe-feu`, `/produits/portes-galandage`, `/produits/incendie`) :
   H1 mot-clé + Casablanca/Maroc, intro originale, grille de produits, FAQ ; le catalogue filtré actuel ne crée pas ces URL.
6. **JSON-LD complet** : `Organization`/`LocalBusiness` (adresse de retrait, téléphone, horaires) dans le layout,
   `BreadcrumbList` sur les fiches, `FAQPage` sur les catégories ; corriger `availability` codé en dur à InStock
   (le lire depuis la donnée produit).
7. **Fiche technique PDF FAW** téléchargeable par famille (mise en page FAW, sans nom de fabricant ni prix d'achat), sans
   formulaire obligatoire (au mieux un téléphone facultatif).
8. **Bloc confiance sur chaque fiche** : photos de poses réelles FAW, « certificats de résistance au feu sur demande »
   (déjà dans les options), adresse du dépôt et horaires, ICE/RC FAW en pied de page.
9. **Réseaux sociaux** : liens Instagram et LinkedIn FAW dans le pied de page et la page contact (aucun aujourd'hui) ;
   garder WhatsApp flottant et ajouter WhatsApp + téléphone dans l'en-tête mobile.
10. **Catégorie Incendie** : guide « quel extincteur pour quel risque » (poudre ABC / CO2 / eau / mousse) et regroupement
    des formats (2/5/6 kg, 6/9 L) sur une même fiche par type, avec mention « Installation non comprise ».
11. **Textes alternatifs et noms de fichiers** d'images descriptifs en français (« porte-coupe-feu-ei60-90cm-1-vantail.jpg »),
    `og:locale` fr_MA et hreflang fr/ar si la version arabe est indexée.
12. **Prix dégressif visible** dès 4 portes (déjà dans `doorOptions`) remonté près du prix + calcul automatique dans le
    panier, et rappel des moyens de paiement acceptés (virement, chèque, paiement à la réception) sur la fiche.

Fichiers de travail (hors projet) : `/workspace/refs/` (HTML brut, script de capture `shot2.mjs`, captures `shots/*.png`).
Aucun fichier de code FAW n'a été modifié.

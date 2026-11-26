# Modules de l’aperçu FAW

## Fonctionnels

- Ventes : commandes/demandes, devis et validation, paniers abandonnés après 30 min d’inactivité, relance WhatsApp préremplie uniquement, analytics first-party (30 jours, sources, villes, produits).
- Catalogue : produits/variantes, catégories, frais par produit/catégorie et ville, garanties facultatives sans texte inventé, attributs, badges, packs, catalogue PDF `/api/catalogue.pdf`.
- Marketing : promotions datées, coupons (limite atomique), popups avec consentement/fréquence, landing pages `/l/<slug>`, redirections 301/302 avec compteur et protection contre les boucles.
- Contenu : accueil éditable (bannière/produit/CTA/blocs, sections existantes conservées par défaut), pages `/pages/<slug>`, technologies `/technologies/<slug>`, blog `/blog` et `/blog/<slug>`, catégories/étiquettes. Le blog est vide : aucun article créé. HTML nettoyé côté Laravel par liste stricte.
- Communication : boîte équipe avec affectation/statut/notes, contacts, assistant du site, clics WhatsApp sans prétendre qu’un message a été envoyé, tickets et formulaire SAV `/sav`. Photos SAV privées avec authentification ; médias publics validés, noms aléatoires, aucun SVG/script.
- Paramètres : thèmes clair/sombre et accents (cuivre actuel par défaut ; préférence du visiteur conservée), réseaux sociaux et bouton flottant, SEO/noindex/robots/sitemap, Meta/GA4/Google Ads après consentement. Aucun traceur tiers sur les liens privés ou confirmations. Conversion Ads sur contact/SAV enregistré seulement, pas une vente encaissée.
- Notifications : Resend ou SMTP utilisables à la validation du devis si configurés. Secrets chiffrés dans `SystemConfig`, écriture seule ; les champs vides conservent la valeur. Fallback Resend : `RESEND_API_KEY`, `QUOTE_EMAIL_FROM`. SMTP : `MAIL_HOST`, `MAIL_PORT`, `MAIL_USERNAME`, `MAIL_PASSWORD` et adresse d’expédition dans Notifications. Désactiver le toggle coupe les envois. Aucune clé n’est exposée par `/api/site-config`.
- Rôles : propriétaire admin et viewer, contrôles réels des réponses d’autorisation Filament 4. Audit des modifications.

## Configuration seulement / adaptateurs distants non activés

- Dynamics : identifiants chiffrés et état honnête, aucun test distant simulé.
- Aramex : configuration et bouton d’expédition désactivé, aucun suivi fictif.
- API GA4 / GSC : configuration chiffrée et notice ; lecture des rapports distants reportée (les analytics du site fonctionnent indépendamment).
- CMI : configuration seulement, toujours désactivé ; aucune carte sur le site.

## Exploitation

- SQLite appartient à Laravel. Le catalogue/les commandes/devis/CMS/config sont servis par REST ; Prisma conserve des lectures de merchandising sur la même base pour compatibilité. Un rechargement de la page publique voit les modifications admin, sans rebuild.
- Les frais sont appliqués une fois par demande (maximum applicable), produit avant catégorie, ville précise avant règle générale. Transport du devis toujours hors total. Les packs sont décomposés en unités DH exactes, stock cumulé vérifié.
- Seule la validation d’équipe réserve un numéro via le script Meta Closer. Tests sur copies `/tmp` avec compteur 9000. Pas de réservation pendant la création ni de journalisation sans email confirmé.
- Démarrage Laravel : `setsid -f scripts/serve-preview.sh > /tmp/faw-api-server.log 2>&1` (port 8000). Next reste sur 3100 et conserve le proxy d’origine publique. Ne pas modifier le watchdog/ngrok.
- Après création du schéma inbox, `php artisan faw:sync-inbox` rapproche les devis et demandes assistant existants sans envoyer de messages ; commande idempotente.
- Sauvegardes SQLite `/tmp/faw-api-before-modules-*.sqlite`, `/tmp/faw-api-before-content-*.sqlite`, `/tmp/faw-api-before-settings-*.sqlite` (permissions 600). Ne jamais committer ni exporter les bases, journaux ou `.env`.
- Tests : `php artisan test`, puis dans le shop `npm run build` et `bash scripts/run-http-integration.sh`. Les fixtures HTTP refusent toute base hors `/tmp` et désactivent compteurs réels, générateur réel et emails.

## Limites explicites

Import CSV des redirections et rapports GA4/GSC distants non livrés. Pas de capture d’écran/validation visuelle : vérification HTTP, Livewire et builds uniquement. Le serveur PHP est réservé à cet aperçu, pas une configuration de production.

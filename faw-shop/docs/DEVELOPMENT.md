# Développement — faw-shop

Le workflow Git (branches, pull requests, revues) est le même que pour l’API : voir `faw-api/docs/DEVELOPMENT.md` et `faw-api/docs/TEAM_ONBOARDING.md`.

La branche par défaut de ce dépôt est **`main`** (renommage local de `master`). Créer les fonctionnalités depuis `develop`.

## Commandes

```sh
npm ci
npm run dev
npm run lint
npx tsc --noEmit
npm run build
bash scripts/check-sensitive-files.sh
```

Le catalogue, les devis et le paiement (désactivé) passent par l’API. `LARAVEL_ORIGIN` doit pointer vers l’instance Laravel de travail.

## Règles propres à la vitrine

- Aucun prix sur les pages publiques, le panier public, le JSON-LD ou les événements d’analytics (identifiant et nom d’article seulement).
- Ne jamais écrire « portes de secours », ni promettre des délais, ni afficher EI120 ou « normes européennes » non validés.
- Ne jamais nommer un fournisseur ou un fabricant, exception documentée : « Genius, fabriqué en Italie » pour le kit.
- Ne pas commiter `.env.local`, bases de données locales, `data/devis/`, `shots/`, journaux.
- Les tests e2e peuvent créer des données de test : les exécuter sur une copie isolée, jamais contre le journal réel.

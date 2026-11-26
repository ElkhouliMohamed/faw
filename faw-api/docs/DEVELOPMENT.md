# Développement — faw-api

## Workflow Git

1. Partir de `develop` à jour : `git checkout develop && git pull` (une fois le remote configuré).
2. Créer une branche : `git checkout -b feature/nom-court` (ou `fix/…`, `hotfix/…`).
3. Développer, tester, commiter en local avec des messages clairs.
4. Pousser la branche et ouvrir une pull request vers `develop`.
5. Attendre la CI et une revue. Ne pas forcer l’historique des branches protégées.

`main` reste réservée au code validé pour la production. `staging` sert à aligner un déploiement de préproduction, lorsque l’environnement existe. Les correctifs urgents partent de `main` via `hotfix/…`, avec accord du propriétaire pour le retour en production.

## Commandes utiles

```sh
php artisan serve --host=127.0.0.1 --port=8000
php artisan test
php artisan migrate
php artisan migrate:status
vendor/bin/pint
bash scripts/php-lint.sh
bash scripts/check-sensitive-files.sh
```

Filament se prévisualise via le front : `http://localhost:3100/admin/login` (relais vers Laravel). L’origine `http://127.0.0.1:8000/admin` est possible en direct, mais le relais public passe par le shop.

## Règles de travail

- Ne pas commiter `.env`, bases, journaux, PDF de devis, uploads clients.
- Ne pas inventer de spécifications, d’adresse de dépôt ou de mentions de garantie.
- Ne pas afficher de prix sur l’API publique (réglage boutique `shop.showPrices`, actuellement désactivé).
- Ne jamais réserver un numéro de devis autrement que par le script prévu, au moment de la validation équipe.
- Ne pas envoyer d’e-mail à un vrai client depuis un poste de développement. Les essais d’e-mail vont uniquement vers une adresse de test convenu (ex. `delivered@resend.dev`).
- Une migration qui détruit ou réécrit des données exige un plan de retour approuvé avant fusion dans `main`.

# Séparation Next.js / Laravel — phase 1

Le front conserve son design et ses routes publiques. Le back-office actif est exclusivement Filament, à `/admin`, relayé vers Laravel avec ses assets et Livewire. L'ancien code admin est conservé localement mais masqué par les rewrites ; son authentification est désactivée.

- Laravel : `/workspace/faw-api`, API locale `http://127.0.0.1:8000`.
- Next : `http://localhost:3100`.
- `LARAVEL_ORIGIN` : origine interne pour les appels SSR et les Server Actions ; mettre aussi la valeur au build pour les rewrites.
- `LARAVEL_DATABASE_URL` : lecture de compatibilité Prisma, défaut `file:/workspace/faw-api/database/database.sqlite`.
- Le catalogue et les demandes de devis/commandes utilisent l'API. Les confirmations/suivis privés et le merchandising lisent encore la base Laravel avec Prisma. **Ne plus lancer de migration Prisma ou `db push` sur cette base.**
- Comptes admin, produits, variantes, catégories, demandes, devis et clients sont gérés dans Filament. La base initiale `prisma/faw.db` est conservée et sauvegardée avant import dans `/tmp/faw-shop-before-laravel.sqlite`.
- Mot de passe initial inchangé ; connexion `admin@faw.ma`, pas de mot de passe dans le code ou la documentation.
- Email actuellement désactivé ; renseigner `RESEND_API_KEY`, `QUOTE_EMAIL_FROM` et une `APP_URL` fonctionnelle uniquement dans l'environnement Laravel privé.
- Le domaine ngrok fourni répondait 404 au contrôle. Sa configuration et le watchdog n'ont pas été touchés.

Procédure complète, imports, modules livrés, règles devis et limites : `/workspace/faw-api/README.md`.

Vérification HTTP : `bash scripts/run-http-integration.sh`, après le build Next, API principale disponible et ports de test 8001/3101 libres. Catalogue synthétique en `/tmp`, aucun vrai compteur/journal appelé, aucun email. Les services de test sont arrêtés à la fin.

Les captures navigateur et le contrôle visuel mobile restent à réaliser avec un outil navigateur disponible. Ne pas assimiler les tests HTTP à une vérification visuelle.

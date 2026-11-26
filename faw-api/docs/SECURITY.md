# Sécurité

Politique de sécurité de l’organisation FAW, appliquée aux dépôts `faw-api` et `faw-shop`. Les règles propres à la vitrine (en-têtes, liens privés Next, ancien admin) sont détaillées dans `docs/SECURITY.md` de `faw-shop`.

## Secrets

- Les secrets vivent uniquement dans des fichiers d’environnement locaux ou dans les espaces secrets de l’hébergeur / de GitHub Actions, une fois configurés.
- Ils restent vides dans `.env.example`. Exemples : `APP_KEY`, `FILAMENT_ADMIN_PASSWORD`, `RESEND_API_KEY`, mots de passe de base, clés SSH, jetons.
- Permissions locales recommandées : `chmod 600` sur `.env`.
- Jamais de secret dans Git, dans une pull request, dans une capture, dans un journal applicatif ou dans un chat non convenu.
- Les identifiants de production ne se recopient pas sur le staging ni sur un poste de développement.

## Fichiers exclus de Git

Ne jamais versionner :

- fichiers `.env` (sauf `.env.example`) ;
- bases (`*.sqlite`, `*.db`) et dumps ;
- sauvegardes ;
- journaux ;
- sessions et caches ;
- contenu privé de `storage/` (PDF de devis, pièces clients) ;
- uploads clients ;
- identifiants de paiement.

La liste complète et le contrôle automatique figurent dans `.gitignore` et `scripts/check-sensitive-files.sh`. La CI échoue si l’un de ces fichiers est suivi.

## Si un secret fuit

1. Le considérer comme compromis : le révoquer et le remplacer (clé Resend, `APP_KEY`, mot de passe, jeton d’hébergement, jeton GitHub, etc.).
2. Prévenir immédiatement le propriétaire (Walfar), sans republier la valeur.
3. Identifier où le secret a circulé (commit, ticket, journal, machine).
4. Un **nettoyage d’historique Git** n’a lieu **que si le propriétaire l’approuve**. Ne pas réécrire l’historique de votre propre initiative, surtout une fois le dépôt poussé.
5. Après rotation, vérifier qu’aucun service ne fonctionne encore avec l’ancienne valeur.

## Authentification à deux facteurs

L’organisation GitHub doit exiger la 2FA pour tous les membres. Les comptes Filament sont individuels ; un mot de passe partagé est interdit. Désactiver sans délai le compte d’une personne qui quitte l’équipe.

## Branches et revue

Les branches `main`, `develop` et `staging` sont protégées (revues, contrôles CI, pas de force-push, pas de suppression). Voir [GITHUB_SETTINGS.md](./GITHUB_SETTINGS.md).

## Application Laravel / Filament

- Le panneau est sous `/admin`, hors de la navigation publique, à ne pas exposer inutilement (HTTPS, cookies sûrs, limitation des tentatives).
- Au moins un compte `admin` doit toujours exister.
- Le rôle `viewer` est strictement en lecture.
- Les actions administratives notables sont journalisées (sans mots de passe).
- Le paiement par carte (CMI) reste désactivé tant que le propriétaire ne l’autorise pas explicitement.
- L’API publique ne renvoie pas les prix tant que le réglage boutique correspondant est désactivé.

## Devis et données clients

- Numéros de devis uniquement via le script prévu, au moment de la validation équipe.
- Pas d’e-mail à un client réel depuis un environnement de test.
- Les PDF de devis et le journal CSV restent hors Git.

## Signalement

Contacter directement le propriétaire. Pas de divulgation publique avant correction.

# Déploiement — faw-shop

La procédure complète en 12 étapes, le plan de retour et les règles de migration sont dans **`faw-api/docs/DEPLOYMENT.md`**. Elle s’applique aux deux dépôts.

Spécificités vitrine :

- Un déploiement production inclut `npm ci` et `npm run build` sur le serveur (ou un artefact issu de la CI, lorsque ce flux aura été validé).
- Prévoir `NEXT_PUBLIC_NOINDEX=1` sur le staging, et `0` seulement en production quand le propriétaire autorise l’indexation.
- Recalculer le build si `NEXT_PUBLIC_SITE_URL` ou les variables `NEXT_PUBLIC_*` changent.
- Aucun déploiement automatique : le workflow GitHub `Déploiement production (manuel)` est un modèle, volontairement incomplet tant que l’hébergement n’est pas choisi.

Aucun achat et aucun go-live sans l’accord du propriétaire.

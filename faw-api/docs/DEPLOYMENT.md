# Déploiement

Procédure commune aux dépôts `faw-api` et `faw-shop`. Aucun déploiement n’est déclenché automatiquement par la CI. Un modèle de workflow manuel (`workflow_dispatch`) existe, bloqué tant que l’environnement GitHub `production` n’est pas configuré et que le propriétaire n’a pas validé la cible.

## Enchaînement en 12 étapes

1. Le développeur crée une branche `feature/*`, `fix/*` ou `hotfix/*`.
2. Il implémente les changements et les teste en local.
3. Les contrôles CI s’exécutent (qualité, tests, secrets, fichiers sensibles).
4. Il ouvre une pull request vers `develop` (ou vers `main` pour un hotfix convenu).
5. Un relecteur examine les changements.
6. Les contrôles exigés doivent être verts.
7. Les changements approuvés sont fusionnés dans la branche d’intégration (`develop`).
8. Le déploiement staging est mis à jour (une fois l’hébergement staging en place).
9. L’équipe FAW valide le site sur le staging (parcours vitrine, devis de test, Filament).
10. Le propriétaire autorise le déploiement en production.
11. Le déploiement production est exécuté par une personne habilitée, via la procédure approuvée (jamais un workflow automatique non validé).
12. Des contrôles d’après-déploiement sont faits : pages publiques, `/api/site-config` ou santé équivalente, connexion Filament, file d’attente et planification si elles sont actives, journaux d’erreur.

## Plan de retour

- Conserver le commit déployé et le précédent (tag ou SHA) pour pouvoir rétablir le code.
- Ne pas déployer une migration destructive sans plan de restauration de la base (sauvegarde prise **avant** la migration, procédure de replay documentée). Voir [BACKUP_RESTORE.md](./BACKUP_RESTORE.md) et [DATABASE.md](./DATABASE.md).
- En cas d’incident : rétablir le code précédent, restaurer la base seulement si le plan l’autorise, vérifier les fichiers privés (PDF de devis, pièces), puis refaire les contrôles de l’étape 12.
- Toute restauration de production se décide avec le propriétaire.

## Migrations

- Les migrations s’exécutent de façon contrôlée, après sauvegarde.
- Une migration qui supprime des colonnes, des tables ou des données n’est fusionnée dans `main` qu’avec un plan de retour **approuvé**.
- Tester d’abord la migration (et son éventuel inverse) sur une copie, puis sur le staging.

## Secrets

- Les secrets de production ne se copient jamais vers le staging ou le développement.
- Staging : base isolée, e-mail de test, `noindex`, identifiants distincts (voir [STAGING_HOSTING.md](./STAGING_HOSTING.md)).
- Le paiement carte reste désactivé tant que le propriétaire ne l’a pas autorisé explicitement.

## Rappel

Rien n’est acheté (hébergeur, domaine supplémentaire, forfait) sans l’accord du propriétaire. Le site n’est pas considéré « déployé en production » tant qu’un déploiement vérifié n’a pas eu lieu.

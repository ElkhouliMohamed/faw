# Sauvegarde et restauration

## Ce qu’il faut sauvegarder

- La base de données (clients, commandes, devis, contenus, comptes).
- Les fichiers privés : PDF de devis, pièces jointes, documents produits hors Git.
- La configuration serveur (sans la commiter) : fichiers d’environnement, certificats, planification.
- Le code, lui, est dans Git ; une sauvegarde ne remplace pas le dépôt, et le dépôt ne remplace pas la base.

## Fréquence recommandée (une fois l’hébergement en place)

- Sauvegarde automatique quotidienne de la base et du stockage privé, conservée hors du serveur d’application (objet ou machine distincte).
- Retenir plusieurs points dans le temps (par exemple 7 jours, plus un point hebdomadaire).
- Tester une restauration sur un environnement isolé, pas directement en production, au moins une fois après la mise en place.

La procédure exacte dépendra de l’hébergeur choisi (voir [STAGING_HOSTING.md](./STAGING_HOSTING.md)). Rien n’est souscrit sans accord du propriétaire.

## Local (développement)

- On peut copier `database/database.sqlite` vers un fichier horodaté **hors du dépôt**, permissions restreintes (`chmod 600`).
- Ne pas placer ces copies dans Git, ni dans un dossier suivi, ni les envoyer par un canal non convenu.
- Les PDF de devis locaux (`DEVIS_OUTPUT_DIR`) suivent la même règle.

## Restauration

1. Le propriétaire décide de restaurer, et à quel point dans le temps.
2. Mettre l’application en maintenance si c’est la production.
3. Restaurer la base et, si besoin, les fichiers privés, selon le plan écrit pour cet environnement.
4. Vérifier un devis, une connexion Filament et une page catalogue.
5. Journaliser l’opération (qui, quand, quel point de restauration).

Une restauration de production sans plan ni accord du propriétaire est interdite.

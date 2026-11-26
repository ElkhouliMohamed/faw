# Versions de devis

- Version 1 = numéro réservé par `prochain_numero.py` à la première validation (seul appel au compteur).
- Une modification des conditions commerciales (quantités, prix unitaires TTC, livraison en option) d'un devis
  validé crée la version suivante : action Filament « Nouvelle version » (permission `validate.quotes`).
- Libellé des versions suivantes : `config/faw.php` → `quote_version_format` (`{numero}-{version}` par défaut,
  choix provisoire). Fichier PDF : toujours `Devis-<numero>-FAW-<version>.pdf` ; un PDF existant n'est jamais écrasé.
- `quote_versions` : instantané figé (lignes, remise 0, TVA 20 %, livraison hors total, totaux, MAD, validité,
  conditions, entrée du générateur, empreinte sha256 du PDF). Contenu protégé par le modèle et par des triggers SQLite.
- `quote_version_emails` : une ligne par tentative d'envoi (queued → sent | failed, id du message fournisseur),
  clé d'idempotence unique `faw-devis-<quote>-v<version>-<tentative>`, aussi transmise à Resend.

## Envoi des e-mails : synchrone (documenté)

`QUEUE_CONNECTION=sync` en production et aucun worker n'est lancé : l'envoi reste synchrone dans la requête Filament,
protégé par le verrou `faw-quote-workflow`, une transaction et la clé unique ci-dessus. Une tentative restée
« queued » plus de 10 minutes est marquée en échec et peut être renvoyée. Passer à une vraie file (database +
`failed_jobs`) demande d'abord un worker supervisé (`php artisan queue:work`).

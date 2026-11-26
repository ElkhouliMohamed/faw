# Paiements — fondations (Phase 6)

État actuel : **seul le virement bancaire est actif**, avec validation manuelle par la finance. **Pas de paiement par carte**. Pas de frais, pas d'intérêts, pas de crédit.

## Ce qui est en place

- Tables `payments`, `payment_transactions` (historique en ajout seul) et `payment_webhook_events` (idempotence).
- Interface `App\Payments\PaymentProvider` et registre `PaymentProviders`.
- `BankTransferProvider` :
  - Lit RIB, titulaire, banque et SWIFT dans `FAW_BANK_RIB`, `FAW_BANK_HOLDER`, `FAW_BANK_NAME` et `FAW_BANK_SWIFT`. Ces valeurs sont **vides par défaut** : le portail affiche alors « RIB communiqué par FAW ».
  - Chaque échéance porte une référence unique `FAW-CMD-AAAA-NNNN-Pn` et le montant dû.
  - Le client peut déposer un justificatif (pdf, jpg ou png, 5 Mo max). Le type MIME est vérifié sur le contenu réel. Le fichier est stocké dans `storage/app/private`.
  - Le paiement passe alors au statut « en vérification ». La finance (ou le super admin) le confirme ou le refuse avec un motif.
- Échéancier par commande (responsable commercial, finance, super admin) :
  - Paiement intégral, acompte + solde, ou plusieurs échéances.
  - Les montants sont **saisis par FAW** et leur somme doit être exactement égale au total. Aucun pourcentage n'est codé en dur.
  - L'échéancier est verrouillé dès qu'un paiement est confirmé ou en vérification.
- Statut de commande : il passe automatiquement à « partiellement payée » puis à « paiement confirmé » quand les paiements sont confirmés.
- `CardProvider` est un squelette **désactivé** : `enabled()` renvoie `false`.
  - `POST /api/payments/webhook/{provider}` répond **503** tant qu'aucun prestataire n'est activé.
  - Le squelette fixe le contrat qu'un futur adaptateur devra respecter :
    - signature HMAC vérifiée en temps constant ;
    - devise MAD uniquement ;
    - référence connue et rattachée au même prestataire ;
    - montant exactement égal ;
    - un événement n'est traité qu'une seule fois (`provider` + `event_id` unique).

## À vérifier auprès de chaque prestataire avant toute activation

Ne rien supposer : chaque point doit être confirmé par écrit, dans le contrat ou la documentation officielle remise à FAW.

### Commun (NAPS, Payzone, CMI)
- Contrat commerçant signé, identifiants de production et de test, environnement de recette.
- **Grille tarifaire réelle** (commission, frais fixes, frais de rejet). Aucun frais ne doit être répercuté au client sans décision de FAW.
- Schéma de signature des notifications : algorithme, champs signés, encodage, rotation des clés.
- Format exact des notifications (champs montant, devise, référence commande, identifiant de transaction, statut), et notification serveur à serveur en plus du retour navigateur.
- Montant exprimé en dirhams ou en centimes. Devise MAD (code 504) uniquement.
- Politique de rejeu et de réessais des notifications ; adresses IP sources si le prestataire les publie.
- 3-D Secure, remboursements (total ou partiel), annulations, délais de règlement.
- Conformité PCI DSS : page de paiement hébergée par le prestataire, aucune donnée de carte chez FAW.
- Paiement **comptant uniquement** : pas de paiement fractionné avec intérêts, pas d'offre de crédit (règle FAW, sans riba).

### NAPS
- URL des environnements, nom et format des paramètres, procédure de signature : selon la documentation remise par NAPS.

### Payzone
- URL des environnements, format des notifications, signature : selon la documentation remise par Payzone.

### CMI
- Le module CMI existant dans le back-office reste **désactivé**.
- URL des environnements, clé de stockage, algorithme de hachage et champs signés : selon le kit d'intégration remis par le CMI.

## Activer un prestataire plus tard (ne pas faire sans décision écrite de FAW)
1. Écrire un adaptateur dédié qui implémente `PaymentProvider` à partir de la documentation officielle, avec ses tests.
2. L'enregistrer dans `PaymentProviders`, puis renseigner son secret dans l'environnement serveur (jamais dans le dépôt).
3. Faire valider la recette par la finance, puis activer.

# Activer l'envoi automatique des devis par e-mail (Resend)

> L'envoi des devis est géré par Laravel (Filament › Devis) : la clé et l'expéditeur se renseignent dans l'environnement privé de `faw-api`, jamais dans la boutique Next.

Une fois ces étapes faites, le client qui a donné son e-mail reçoit son devis dès que l'équipe clique sur « Valider ».
Sans ces étapes, rien ne change : le devis s'envoie à la main (WhatsApp / PDF).

Comptez 20 à 30 minutes, plus le temps de propagation DNS (quelques minutes à quelques heures).

## 1. Créer le compte Resend (gratuit)
1. Allez sur https://resend.com et cliquez sur « Sign up ».
2. Inscrivez-vous avec l'adresse de FAW (par exemple faw@faw.ma) et confirmez l'e-mail reçu.
3. L'offre gratuite suffit pour les devis : 3 000 e-mails par mois, 100 par jour (une copie cachée compte comme un e-mail de plus).

## 2. Ajouter et vérifier le domaine faw.ma
Cette étape est indispensable. Sans domaine vérifié, Resend n'envoie qu'à l'adresse du titulaire du compte, et vos clients ne recevraient rien.

1. Dans Resend : menu « Domains », puis « Add Domain ». Tapez `faw.ma`. Si un choix de région vous est proposé, prenez « EU » (Irlande, la plus proche du Maroc) ; sinon gardez la région par défaut.
2. Resend affiche 3 ou 4 enregistrements DNS à créer :
   - SPF : un enregistrement `MX` et un `TXT` sur `send.faw.ma` ;
   - DKIM : un `TXT` sur `resend._domainkey.faw.ma` ;
   - DMARC : facultatif mais conseillé, un `TXT` sur `_dmarc.faw.ma`.
3. Copiez-les **exactement** chez le gestionnaire DNS de faw.ma. C'est soit votre registrar (là où le nom de domaine a été acheté), soit Framer si le DNS y a été déplacé. Dans la zone DNS, ajoutez chaque enregistrement avec le même type, le même nom et la même valeur.
   - Ne supprimez pas les enregistrements existants (site Framer, e-mail faw@faw.ma).
   - Si vous ne savez pas où est géré le DNS, votre registrar ou Framer peut vous l'indiquer.
4. Revenez dans Resend et cliquez sur « Verify DNS Records ». Le domaine doit passer en « Verified » (vert).

Je ne peux pas modifier le DNS de faw.ma à votre place : c'est vous (ou la personne qui gère le domaine) qui ajoutez ces enregistrements.

## 3. Créer la clé API
1. Dans Resend : menu « API Keys », puis « Create API Key ».
2. Nom : `FAW boutique devis`. Permission : **Sending access** (envoi seulement, pas « Full access »). Domaine : `faw.ma`.
3. Cliquez sur « Add ». La clé commence par `re_` et ne s'affiche qu'une fois : gardez la fenêtre ouverte pour l'étape suivante.

## 4. Me transmettre les informations
- **La clé API** : uniquement par la carte « secret » masquée que je vous enverrai. **Jamais dans le chat**, ni par WhatsApp, ni par e-mail. Si elle a été collée ailleurs par erreur, supprimez-la dans Resend et créez-en une nouvelle.
- **L'adresse d'expédition**, par exemple `FAW Aluminium <devis@faw.ma>` (n'importe quelle adresse en @faw.ma, une fois le domaine vérifié).
- **L'adresse de réponse** : `faw@faw.ma` par défaut (les réponses des clients arrivent là).
- Facultatif : une adresse qui reçoit une copie cachée de chaque devis envoyé.

Je les ajoute ensuite dans la configuration de la boutique et je fais un envoi de test vers votre propre adresse avant la mise en service.

## Ensuite, au quotidien
- Admin › Devis affiche « Email automatique activé ».
- À l'ouverture d'un devis, la fiche indique si l'e-mail est parti, quand, ou l'erreur éventuelle. Le bouton « Renvoyer l'email » renvoie le devis au client.
- Un client sans e-mail reçoit toujours son lien privé par WhatsApp (bouton dans la fiche).
- Pour tout arrêter : supprimez la clé dans Resend. La boutique repasse en envoi manuel.

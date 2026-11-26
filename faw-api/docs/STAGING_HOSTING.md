# Hébergement staging et production

Aucun achat, abonnement ou réservation n’est fait sans l’accord du propriétaire.

## Constat de l’existant

L’aperçu actuel tourne sur la machine de développement :

- vitrine Next.js sur le port 3100 ;
- API Laravel / Filament sur 127.0.0.1:8000, relais par le front ;
- publication temporaire via un tunnel ngrok ;
- base SQLite locale, fichiers privés et journaux de devis sur la même machine.

C’est un **aperçu de travail**, pas un staging d’équipe : l’URL peut changer, il n’y a pas d’authentification individuelle durable pour tout le personnel, la machine n’offre pas de sauvegarde hors site ni de séparation d’environnements. Le watchdog local ne doit pas être modifié dans le cadre de cette préparation GitHub.

## Cible recommandée

Trois plans nets :

1. **GitHub** — organisation privée, dépôts privés, CI (déjà préparés dans les dépôts).
2. **Staging** — site de prévisualisation réservé à l’équipe, comptes ou passerelle d’identité **individuels**.
3. **Production** — site public sous le domaine officiel FAW ; Filament reste protégé (HTTPS, cookies sûrs, `/admin` non exposé inutilement, accès nominatifs).

Parce que le front relais déjà `/admin` et `/api` vers Laravel, un **même nom d’hôte** par environnement (un origine unique) est plus simple qu’un front chez un hébergeur et une API chez un autre (cookies, CSRF, rewrites).

### Architecture proposée

- Un serveur virtuel **staging** et un serveur virtuel **production**, isolés (ou deux piles clairement séparées si un seul hyperviseur est retenu plus tard, ce qui est moins net).
- Reverse proxy + HTTPS, de préférence derrière **Cloudflare** (DNS, certificat, WAF de base).
- Next.js (Node) et Laravel (PHP-FPM) sur le même serveur, ou deux processus sur la même machine.
- Base **dédiée à l’environnement** : PostgreSQL ou MySQL en production et en staging (SQLite reste acceptable en local seulement).
- Stockage privé **hors racine web** (équivalent de `storage/app/private`) pour les PDF de devis et pièces.
- File d’attente et planificateur Laravel (`queue worker`, `cron` / `scheduler`) dès qu’ils seront réellement utilisés.
- E-mail transactionnel via Resend, déjà prévu par l’application : domaine d’envoi vérifié en production ; en staging, expéditeur et clés **de test** uniquement, jamais la clé de production, destinataires limités aux adresses de test convenues.
- Sauvegardes quotidiennes chiffrées de la base et du stockage privé, copiées hors du serveur (voir [BACKUP_RESTORE.md](./BACKUP_RESTORE.md)).
- Supervision minimale : disponibilité HTTPS, espace disque, journaux d’erreur.

Fournisseurs compatibles, à départager avec le propriétaire (aucun n’est souscrit ici) : VPS européens type **OVHcloud** (données en France possibles) ou **Hetzner** (Allemagne), éventuellement un équivalent régional s’il offre snapshot et objet de sauvegarde. Laravel Forge, Ploi ou un durcissement manuel (Caddy/Nginx + systemd) peuvent gérer PHP, Node, les certificats et les workers. Vercel seul pour le front n’est pas le premier choix, à cause du relais `/admin` et `/api`.

### Accès au staging

- Nom d’hôte dédié (exemple de forme : `staging.<domaine-officiel>`), à décider avec le propriétaire.
- **Cloudflare Access** (ou passerelle d’identité équivalente) devant le staging : chaque personne s’authentifie avec **son e-mail professionnel**, pas un mot de passe commun.
- `noindex` et robots interdisant l’indexation.
- Base isolée, données de test ou copie **anonymisée** si une copie est un jour autorisée — jamais la base de production montée en direct.
- E-mail de test seulement.
- Secrets distincts de la production (`APP_KEY`, mots de passe, clé Resend, cookies).

Le même type de passerelle peut aussi protéger `/admin` en production, en complément des comptes Filament, si le propriétaire le souhaite.

## Ordre de grandeur des coûts

Relevés au 10–11 novembre 2026, **hors taxes**, pour aider à une décision — pas un devis, pas une commande :

- OVHcloud VPS-2 2027 (4 vCPU, 8 Go, 75 Go, Gravelines, France) : **8,49 € HT / mois** ([comparateurcloud.fr](https://comparateurcloud.fr/observatoire-prix-cloud/), [infrarabbit.com](https://infrarabbit.com/prices/vps/ovhcloud/vps-2027-model1) pour l’offre voisine VPS-1 à 4,49 € HT).
- Hetzner Cloud CX33 (4 vCPU, 8 Go, 80 Go NVMe, Allemagne) : **8,49 € HT / mois** ([cloudtally.eu](https://cloudtally.eu/hetzner-cloud-prices), prix Allemagne vérifiés le 10 novembre 2026).

Deux environnements de cette classe tournent autour de **17 € HT / mois**, avant stockage de sauvegarde, nom de domaine déjà détenu ou à renouveler, et l’éventuel forfait Cloudflare / Resend au-delà des offres gratuites. Vérifier le tarif en vigueur sur le site de l’éditeur avant toute décision. **Rien n’est acheté sans l’accord de Walfar.**

## Accès staging — procédure cible (quand l’environnement existera)

1. Le propriétaire crée le compte Cloudflare Access (ou équivalent) et y inscrit les e-mails individuels de l’équipe.
2. Chaque personne ouvre l’URL staging, s’authentifie, puis parcourt la vitrine.
3. Filament : compte individuel, rôle `admin` ou `viewer` selon la fonction (voir [TEAM_ACCESS.md](./TEAM_ACCESS.md)).
4. En cas de départ, retirer l’e-mail de la passerelle **et** désactiver le compte Filament.

Tant que cet environnement n’existe pas, l’équipe peut consulter l’aperçu temporaire seulement si le propriétaire le partage, en gardant à l’esprit ses limites.

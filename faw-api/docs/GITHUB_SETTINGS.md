# Réglages GitHub — liste du propriétaire

Actions **manuelles**, à réaliser par le propriétaire (Walfar). Ce document ne crée pas l’organisation, n’invite personne, ne pousse pas le code et ne déploie rien. Remplacer le placeholder `FAW-ORG` par l’identifiant réel de l’organisation une fois choisi. Ne pas inventer de noms ou d’adresses de membres.

## 1. Créer l’organisation

1. Sur GitHub : créer une organisation **privée** au nom de FAW (plutôt qu’héberger le projet sur un compte personnel).
2. Le compte personnel du propriétaire devient propriétaire de l’organisation.
3. Activer l’**obligation de 2FA** pour tous les membres (Settings de l’organisation › Authentication security › Require two-factor authentication).

## 2. Créer les dépôts privés

1. Créer deux dépôts **privés** : `faw-api` et `faw-shop` (noms à confirmer).
2. Ne pas les rendre publics.
3. Branche par défaut : **`main`** (y compris pour `faw-shop`, renommé localement depuis `master`).
4. Ne pas initialiser le dépôt GitHub avec un README qui ferait un historique parallèle : préférer un dépôt vide, puis un premier push autorisé par le propriétaire.
5. Désactiver Wikis et Releases publics si inutiles ; Issues : au choix du propriétaire.

## 3. Analyse de secrets et protection des pushes

Dans chaque dépôt, Settings › Code security :

- activer **Secret scanning** ;
- activer **Push protection** (bloquer un push qui contient un secret) dès que le plan GitHub de l’organisation le permet ;
- Dependabot est préparé dans le fichier `.github/dependabot.yml` du dépôt : l’activer si le plan le permet.

## 4. Permissions des Actions

Settings › Actions › General :

- Autoriser les actions nécessaires au CI (actions GitHub et, pour l’API, `shivammathur/setup-php`).
- **Workflow permissions :** lecture seule (`Read repository contents and packages permissions`) par défaut.
- Ne pas autoriser l’approbation des runs depuis des forks publics (dépôts privés : sans objet, à laisser restrictif).

## 5. Créer les équipes

Settings de l’organisation › Teams. Créer, sans y ajouter encore de personnes si la liste n’est pas arrêtée :

| Équipe | Rôle dépôt recommandé |
|---|---|
| `faw-owners` | Admin |
| `faw-developers` | Write |
| `faw-marketing-seo` | Read |
| `faw-sales` | pas d’accès dépôt par défaut |
| `faw-stock-logistics` | pas d’accès dépôt par défaut |
| `faw-finance` | pas d’accès dépôt par défaut |
| `faw-viewers` | Read, seulement si besoin |

Détail des responsabilités : [TEAM_ACCESS.md](./TEAM_ACCESS.md).

Fichier `CODEOWNERS` : il pointe aujourd’hui vers `@FAW-ORG/faw-owners`. Après création, remplacer `FAW-ORG` par l’identifiant réel dans les deux dépôts.

## 6. Inviter les membres

1. Chaque personne utilise **son propre compte GitHub** (pas de mot de passe partagé).
2. Organization › People › Invite : saisir l’adresse ou le login **réel**, fourni par l’intéressé, jamais un compte inventé.
3. Affecter la personne à une équipe, au rôle le plus bas suffisant.
4. Vérifier que la 2FA est bien active avant (ou dès) l’acceptation, selon le réglage d’organisation.
5. Ne pas inviter de comptes externes sans autorisation explicite du propriétaire.
6. Ne pas transférer la propriété des dépôts sans cette même autorisation.

Tant que ces invitations n’ont pas été envoyées et acceptées, personne n’est « membre » au sens GitHub.

## 7. Règles de branches (rulesets)

Pour **chaque** dépôt, créer un ruleset (ou des rulesets) ciblant `main`, `develop` et `staging` :

- empêcher la **suppression** de la branche ;
- empêcher le **force-push** ;
- exiger une **pull request** pour fusionner ;
- exiger au moins **une revue** (deux sur `main` si le propriétaire le souhaite, dès qu’il y a assez de relecteurs) ;
- exiger que les **contrôles CI** soient verts (workflow `CI` : job « Qualité, tests et secrets » / « Qualité, build et secrets ») ;
- requérir que la branche soit à jour avant fusion, si possible ;
- restreindre qui peut pousser (Owners / Developers selon la branche).

Les branches `feature/*`, `fix/*`, `hotfix/*` restent libres pour le travail quotidien, sans ces verrous.

## 8. Environnements GitHub

Settings › Environments, dans chaque dépôt :

- `staging` : protection optionnelle, relecteurs parmi les Owners si un déploiement staging est un jour automatisé.
- `production` : **relecteurs requis** (équipe `faw-owners` ou le compte du propriétaire). Le workflow manuel de déploiement cible cet environnement et **ne déploie rien** tant que la procédure réelle n’est pas validée.

Ne pas y coller encore de secrets d’hébergement : ils se créeront après le choix de l’hôte, en les nommant par exemple `PRODUCTION_HOST`, `PRODUCTION_USER`, `PRODUCTION_SSH_KEY`, `PRODUCTION_APP_PATH`. Jamais de secret de production dans l’environnement staging.

## 9. Premier envoi du code

Uniquement après accord explicite du propriétaire :

1. Ajouter le remote privé.
2. Pousser `main` et `develop` (et plus tard `staging` si besoin).
3. Vérifier que la CI passe, que Secret scanning est actif, que les rulesets s’appliquent.

Sans cet accord, les dépôts restent locaux, sans remote.

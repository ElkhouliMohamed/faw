# Accès de l’équipe

Principe : **moindre privilège**, comptes **individuels**, pas d’identifiant partagé. Aucun nom ou e-mail de membre n’est inventé ici. Les invitations GitHub et la création des comptes Filament restent des actions manuelles du propriétaire (voir [GITHUB_SETTINGS.md](./GITHUB_SETTINGS.md)). Personne n’a été invité par cette documentation.

## Équipes GitHub proposées

Organisation GitHub **privée** au nom de FAW (recommandée plutôt qu’un compte personnel). Remplacer le placeholder `FAW-ORG` par l’identifiant réel une fois l’organisation créée.

| Équipe | Rôle GitHub | Dépôts | Responsabilités | Ce qui est exclu par défaut |
|---|---|---|---|---|
| FAW Owners | Admin | `faw-api`, `faw-shop` | Administration du dépôt, règles de branches, approbations de déploiement | — |
| FAW Developers | Write | `faw-api`, `faw-shop` | Branches, pull requests, tests, corrections | Secrets de production, réglages d’organisation |
| FAW Marketing & SEO | Read | les deux, si besoin de la doc et des contenus versionnés | Documentation SEO, planification de contenu, gestion de contenu dans Filament | Administration financière ou clients sensibles, sauf autorisation séparée |
| FAW Sales | aucun accès dépôt par défaut | — | Devis, demandes, commandes dans Filament | Administration GitHub, configuration système, paiements non autorisés |
| FAW Stock & Logistics | aucun accès dépôt par défaut | — | Stock, préparation, statuts de livraison dans Filament | Paiements, configuration système, administration GitHub |
| FAW Finance | aucun accès dépôt par défaut | — | Consultation autorisée des paiements, rapprochements (quand ils existeront) | Administration technique, accès dépôt |
| FAW Viewers | Read | selon autorisation | Lecture seule des zones autorisées | Écriture au dépôt, actions Filament autre que lecture |

Les équipes Sales, Stock et Finance travaillent d’abord dans Filament. Un accès GitHub ne leur est ouvert que si le propriétaire le décide, au rôle le plus bas possible (en général Read).

Personne ne reçoit Admin « pour aller plus vite ». Maintain n’est pas nécessaire tant que Owners et Developers couvrent les besoins.

## Matrice des rôles Filament (implémentée)

Les comptes sont nominatifs. Seul un **super administrateur** crée ou modifie les utilisateurs et leurs rôles. Le mot de passe n’est jamais réaffiché. Un compte peut être **désactivé** (plus de connexion) sans être supprimé. Au moins un super administrateur **actif** doit toujours demeurer.

Correspondance des comptes déjà présents : `admin@faw.ma` → Super administrateur ; `agent@faw.ma` → Lecteur.

| Rôle (valeur) | Lecture typique | Écriture | Valider / refuser un devis, renvoyer l’e-mail | Utilisateurs et journal d’activité | Configuration système / intégrations | Notes |
|---|---|---|---|---|---|---|
| Super administrateur (`super_admin`) | Tout | Tout | oui | oui (lecture et gestion des comptes ; journal en lecture seule) | oui | Au moins un compte actif doit toujours exister. Ancien rôle `admin` encore compris comme équivalent. |
| Administrateur technique (`technical_admin`) | Réglages, intégrations, CMI (consultation), analytics | Réglages et intégrations | non | non | oui, sauf gestion des utilisateurs | Ne gère pas les super administrateurs ni les comptes. L’activation CMI reste bloquée dans l’application. |
| Responsable commercial (`sales_manager`) | Devis, clients, commandes, paniers, inbox, analytics | Devis, clients, commandes, paniers, inbox | oui | non | non | Encadrement des ventes. |
| Commercial (`sales_rep`) | Idem responsable commercial (hors validation) | Devis, clients, commandes, paniers, inbox | non | non | non | Pas de validation ni de renvoi d’e-mail de devis. |
| Responsable produits et catalogue (`catalogue_manager`) | Catalogue, médias, promotions, pages techniques | Produits, catégories, attributs, badges, packs, garanties, médias, promotions | non | non | non | Pas d’accès aux clients, devis ou finances. |
| Responsable SEO et contenu (`seo_content_manager`) | CMS, blog, SEO, médias, redirections, analytics | Pages, blog, landing, popups, redirections, SEO, réseaux, médias | non | non | non | Pas d’accès aux données clients ou financières. |
| Responsable stock et logistique (`stock_manager`) | Catalogue, commandes, livraisons, clients (consultation) | Stock / disponibilité produit, préparation et statut de livraison, villes et frais de port | non | non | non | Ne crée ni ne supprime les fiches produit. |
| Responsable finance (`finance_manager`) | Commandes, CMI, analytics, paramètres société | Notes / suivi de paiement sur les commandes | non | non | non | Pas d’accès à la configuration technique. CMI en consultation seulement. |
| Lecteur (`viewer`) | Catalogue, devis, clients, commandes, contenu, analytics (consultation) | aucune | non | non | non | **Lecture seule stricte.** Pas d’accès aux utilisateurs, au journal d’activité ni aux intégrations système. |

Le rôle historique `admin` est accepté par l’application comme un super administrateur (compatibilité). Les nouveaux comptes doivent utiliser `super_admin`.

## Journal d’activité

Chaque création, modification ou suppression réalisée dans le back-office laisse une ligne : qui, quoi, quand, modèle, identifiant, écarts. Les mots de passe, jetons et secrets sont enregistrés comme `[masqué]`. Le journal est consultable **en lecture seule** par les super administrateurs (`/admin/audit-log`).

## Règles communes

- Un compte GitHub et un compte Filament par personne.
- 2FA sur GitHub (obligation d’organisation).
- Désactivation rapide des accès dès qu’une personne quitte l’équipe.
- Traçabilité des actions d’administration : voir ci-dessus.

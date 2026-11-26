# Sécurité — faw-shop

La politique d’organisation (gestion des secrets, liste d’exclusions, conduite à tenir si un secret fuit, 2FA, interdiction de réécrire l’historique sans l’accord du propriétaire) est dans **`faw-api/docs/SECURITY.md`**. À appliquer aussi à ce dépôt.

## Administration historique Next

Un espace `/admin` Next existe encore dans le code mais **n’accorde plus les droits métier** : Filament (via l’API) est le seul back-office. S’il reste une garde par mot de passe :

- `ADMIN_PASSWORD_HASH` (scrypt, `node scripts/hash-password.mjs`) ou `ADMIN_PASSWORD`, comparés en temps constant ;
- verrouillage par IP après plusieurs échecs ;
- session signée, cookie `httpOnly`, `SameSite=Strict`, `Secure` en HTTPS ;
- `/admin` reste exclu de l’indexation.

## Requêtes et formulaires

- CSRF : en-tête `Origin` des Server Actions (`SERVER_ACTIONS_ALLOWED_ORIGINS` pour un domaine supplémentaire).
- Validation des entrées, champ piège, temps minimum de remplissage, limite de débit par IP.
- Uploads : type vérifié par le contenu, taille limitée, nom aléatoire, pas de traversée de chemin.

## En-têtes

CSP avec nonce, HSTS, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`, `X-Content-Type-Options: nosniff`.

## Données, mesure, devis

- Aucun secret ni donnée personnelle dans les journaux.
- `.env.local` en `chmod 600`, jamais commité.
- GA4 et Meta Pixel seulement après consentement, et seulement si l’identifiant est configuré (Filament › Intégrations, ou variables publiques en repli). Les événements n’embarquent pas de prix.
- Lien privé de suivi : jeton 192 bits, `no-store`, `noindex`, limite de débit. Le PDF n’est servi qu’après validation, au porteur du jeton.
- E-mail Resend désactivé tant que la clé et l’expéditeur sont vides. Jamais d’e-mail à un vrai client depuis un poste de test.

## Signalement

Prévenir le propriétaire. Pas de divulgation publique avant correction.

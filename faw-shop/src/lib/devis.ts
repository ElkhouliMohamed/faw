// Devis : Laravel génère, numérote, valide et sert les PDF. La boutique ne garde que le format du lien privé.

/** Jeton brut du lien privé client (32 caractères base64url, même format que Laravel Quote::newRawToken). */
export const QUOTE_TOKEN_RE = /^[\w-]{32}$/;

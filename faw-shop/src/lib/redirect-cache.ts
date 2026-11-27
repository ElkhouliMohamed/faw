// Cache mémoire des redirections SEO (middleware) : évite un appel Laravel par page vue.
// Partagé via globalThis entre le middleware (runtime nodejs) et la route /revalidate, qui le vide (étiquette "redirects").

export type ResolvedRedirect = { to: string; code: 301 | 302 } | null;
type Entry = { value: ResolvedRedirect; expires: number };

const TTL_MS = 60_000;
const MAX_ENTRIES = 5000;
const KEY = Symbol.for("faw.redirect-cache");

function store(): Map<string, Entry> {
  const g = globalThis as unknown as Record<symbol, Map<string, Entry> | undefined>;
  return (g[KEY] ??= new Map());
}

export function cachedRedirect(path: string): ResolvedRedirect | undefined {
  const hit = store().get(path);
  if (!hit) return undefined;
  if (hit.expires < Date.now()) {
    store().delete(path);
    return undefined;
  }
  return hit.value;
}

export function rememberRedirect(path: string, value: ResolvedRedirect) {
  const map = store();
  if (map.size >= MAX_ENTRIES) {
    const now = Date.now();
    for (const [k, v] of map) if (v.expires < now) map.delete(k);
    if (map.size >= MAX_ENTRIES) map.clear();
  }
  map.set(path, { value, expires: Date.now() + TTL_MS });
}

export function clearRedirectCache() {
  store().clear();
}

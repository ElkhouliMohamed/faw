// Redirections du back-office appliquées dans le middleware (runtime Node) : instantané JSON + compteur de visites.
import { existsSync, mkdirSync, readFileSync, renameSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { redirectHitsFile, redirectsFile, type RedirectHits, type RedirectSnapshot } from "./redirect-files";

let snap: RedirectSnapshot = {};
let mtime = -1;
let checkedAt = 0;
function load() {
  const now = Date.now();
  if (now - checkedAt < 2000) return snap;
  checkedAt = now;
  try {
    const f = redirectsFile();
    if (!existsSync(f)) {
      snap = {};
      mtime = -1;
      return snap;
    }
    const m = statSync(f).mtimeMs;
    if (m !== mtime) {
      snap = JSON.parse(readFileSync(f, "utf8")) as RedirectSnapshot;
      mtime = m;
    }
  } catch {
    snap = {};
  }
  return snap;
}

const pending = new Map<string, number>();
let timer: ReturnType<typeof setTimeout> | null = null;
function flush() {
  timer = null;
  try {
    const f = redirectHitsFile();
    let cur: RedirectHits = {};
    try {
      cur = JSON.parse(readFileSync(f, "utf8")) as RedirectHits;
    } catch {}
    const last = new Date().toISOString();
    for (const [k, n] of pending) cur[k] = { n: (cur[k]?.n ?? 0) + n, last };
    pending.clear();
    mkdirSync(path.dirname(f), { recursive: true });
    const tmp = `${f}.${process.pid}.tmp`;
    writeFileSync(tmp, JSON.stringify(cur), { mode: 0o600 });
    renameSync(tmp, f);
  } catch {}
}

export function matchRedirect(pathname: string) {
  const s = load();
  const key = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  let hit = Object.hasOwn(s, key) ? s[key] : undefined;
  if (!hit) {
    try {
      const dec = decodeURIComponent(key);
      if (Object.hasOwn(s, dec)) hit = s[dec];
    } catch {}
  }
  if (!hit) return null;
  pending.set(key, (pending.get(key) ?? 0) + 1);
  if (!timer) timer = setTimeout(flush, 3000);
  return hit;
}

import "server-only";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { prisma } from "@/lib/db";
import { redirectHitsFile, redirectsFile, type RedirectHits, type RedirectSnapshot } from "./redirect-files";

/** Réécrit l'instantané lu par le middleware (écriture atomique). */
export async function syncRedirectSnapshot() {
  const rows = await prisma.redirect.findMany({ where: { active: true } });
  const snap: RedirectSnapshot = Object.fromEntries(rows.map((r) => [r.from, { to: r.to, code: r.code === 302 ? 302 : 301 }]));
  const f = redirectsFile();
  await mkdir(path.dirname(f), { recursive: true });
  const tmp = `${f}.${process.pid}.tmp`;
  await writeFile(tmp, JSON.stringify(snap), { mode: 0o600 });
  await rename(tmp, f);
}
export async function readRedirectHits(): Promise<RedirectHits> {
  try {
    return JSON.parse(await readFile(redirectHitsFile(), "utf8")) as RedirectHits;
  } catch {
    return {};
  }
}

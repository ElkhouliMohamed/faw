"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import {
  ADMIN_COOKIE,
  adminConfigured,
  checkPassword,
  clearFailures,
  currentAdmin,
  LOCK_DURATION_MS,
  MAX_FAILS_COUNT,
  verifyScrypt,
  cookieSecure,
  createSessionToken,
  lockRemainingMs,
  recordFailure,
  revokeCurrentSession,
} from "@/lib/admin-auth";
import { clientIp } from "@/lib/security";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/admin/perm";

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().max(160).optional().transform((v) => v || undefined),
  password: z.string().min(1).max(200),
  next: z.string().max(200).optional(),
});

export async function adminLogin(_: { error?: string } | null, fd: FormData) {
  const ip = await clientIp();
  const key = `login:${ip}`;
  const locked = lockRemainingMs(key);
  if (locked > 0) return { error: `Trop de tentatives. Réessayez dans ${Math.ceil(locked / 60_000)} min.` };
  await new Promise((r) => setTimeout(r, 400)); // ralentit le brute-force
  const parsed = loginSchema.safeParse({ email: fd.get("email") ?? undefined, password: fd.get("password") ?? "", next: fd.get("next") ?? undefined });
  if (!adminConfigured()) return { error: "Accès administrateur non configuré" };
  const fail = (msg = "Identifiants incorrects") => {
    recordFailure(key);
    const after = lockRemainingMs(key);
    return { error: after > 0 ? `Trop de tentatives. Réessayez dans ${Math.ceil(after / 60_000)} min.` : msg };
  };
  if (!parsed.success) return fail();
  let s: ReturnType<typeof createSessionToken> = null;
  if (parsed.data.email) {
    // Compte utilisateur : verrouillage par compte en plus du verrouillage par IP.
    const u = await prisma.adminUser.findUnique({ where: { email: parsed.data.email } });
    if (u?.lockedUntil && u.lockedUntil.getTime() > Date.now())
      return { error: `Compte verrouillé. Réessayez dans ${Math.ceil((u.lockedUntil.getTime() - Date.now()) / 60_000)} min.` };
    if (!u || !u.active || !verifyScrypt(parsed.data.password, u.passwordHash)) {
      if (u) {
        const count = u.failedCount + 1;
        const lock = count >= MAX_FAILS_COUNT();
        await prisma.adminUser.update({ where: { id: u.id }, data: { failedCount: lock ? 0 : count, lockedUntil: lock ? new Date(Date.now() + LOCK_DURATION_MS()) : null } });
        if (lock) await audit(null, "lockout", "users", u.id, `verrouillage après ${count} échecs`);
      }
      return fail();
    }
    await prisma.adminUser.update({ where: { id: u.id }, data: { failedCount: 0, lockedUntil: null, lastLoginAt: new Date() } });
    s = createSessionToken(u);
    await audit({ uid: String(u.id), name: u.name, email: u.email, role: "viewer", owner: false }, "login", "session");
  } else {
    if (!checkPassword(parsed.data.password)) return fail("Mot de passe incorrect");
    s = createSessionToken();
    await audit({ uid: "o", name: "Propriétaire", email: null, role: "admin", owner: true }, "login", "session");
  }
  clearFailures(key);
  if (!s) return { error: "Accès administrateur non configuré" };
  (await cookies()).set(ADMIN_COOKIE, s.token, {
    httpOnly: true,
    sameSite: "strict",
    secure: await cookieSecure(),
    path: "/admin",
    maxAge: s.maxAge,
  });
  const next = parsed.data.next || "/admin";
  redirect(next.startsWith("/admin") && !next.startsWith("//") && !next.includes("\\") ? next : "/admin");
}

export async function adminLogout() {
  const a = await currentAdmin();
  if (a) await audit(a, "logout", "session");
  await revokeCurrentSession();
  (await cookies()).delete({ name: ADMIN_COOKIE, path: "/admin" });
  redirect("/admin");
}

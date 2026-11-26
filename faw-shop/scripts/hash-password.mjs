#!/usr/bin/env node
// Génère ADMIN_PASSWORD_HASH (scrypt) à coller dans .env.local. Le mot de passe est lu sur l'entrée standard, jamais affiché.
// Usage : node scripts/hash-password.mjs   (tapez le mot de passe puis Entrée)
import { randomBytes, scryptSync } from "node:crypto";
import { stdin } from "node:process";

let buf = "";
stdin.setEncoding("utf8");
stdin.on("data", (d) => (buf += d));
stdin.on("end", () => {
  const pw = buf.replace(/\r?\n$/, "");
  if (pw.length < 10) {
    console.error("Mot de passe trop court (10 caractères minimum).");
    process.exit(1);
  }
  const N = 16384, r = 8, p = 1;
  const salt = randomBytes(16);
  const hash = scryptSync(pw, salt, 32, { N, r, p });
  console.log(`ADMIN_PASSWORD_HASH=scrypt:${N}:${r}:${p}:${salt.toString("base64")}:${hash.toString("base64")}`);
});

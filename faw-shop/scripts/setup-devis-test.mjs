#!/usr/bin/env node
// Prépare une COPIE isolée du générateur de devis dans /tmp/faw-devis-test pour le dev et les tests.
// Ne modifie jamais /workspace/meta-closer : lecture seule des fichiers source.
// Compteur de test : 9000 → les devis de test portent des numéros ≥ 9001 ; journal de test vide (en-tête seul).
import { copyFileSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

const SRC = process.env.DEVIS_SOURCE_DIR || "/workspace/meta-closer";
const DST = "/tmp/faw-devis-test";
rmSync(DST, { recursive: true, force: true });
for (const d of ["devis", "produits", "out", "uploads"]) mkdirSync(path.join(DST, d), { recursive: true });
for (const f of ["generer_devis.py", "prochain_numero.py", "logo-faw.jpeg", "message-devis.md"]) copyFileSync(path.join(SRC, "devis", f), path.join(DST, "devis", f));
copyFileSync(path.join(SRC, "produits", "produits-reference.csv"), path.join(DST, "produits", "produits-reference.csv"));
const header = readFileSync(path.join(SRC, "devis", "journal-devis.csv"), "utf8").split(/\r?\n/)[0];
writeFileSync(path.join(DST, "devis", "journal-devis.csv"), header + "\n");
writeFileSync(path.join(DST, "devis", "compteur-devis.txt"), "9000");
console.log(`Copie de test prête dans ${DST} (compteur 9000, journal vide).`);
console.log(`DEVIS_GENERATOR_SCRIPT=${DST}/devis/generer_devis.py`);
console.log(`DEVIS_COUNTER_SCRIPT=${DST}/devis/prochain_numero.py`);
console.log(`DEVIS_JOURNAL_PATH=${DST}/devis/journal-devis.csv`);
console.log(`DEVIS_OUTPUT_DIR=${DST}/out  UPLOAD_DIR=${DST}/uploads  FAW_TEST=1`);

#!/usr/bin/env python3
"""Numéro de devis FAW partagé (WhatsApp + site). Atomique (verrou fichier).
Usage : python3 prochain_numero.py          -> réserve et affiche le prochain numéro (ex. 629)
        python3 prochain_numero.py --peek   -> affiche le prochain numéro sans le réserver
Le dernier numéro réservé est dans compteur-devis.txt ; le prochain = max(compteur, plus grand
numéro entier de journal-devis.csv) + 1. Le journal reste en écriture par ajout seulement (une ligne par devis envoyé)."""
import csv, fcntl, os, re, sys
ICI = os.path.dirname(os.path.abspath(__file__))
CPT = os.path.join(ICI, 'compteur-devis.txt'); JRN = os.path.join(ICI, 'journal-devis.csv')
def dernier_journal():
    m = 0
    try:
        with open(JRN, newline='', encoding='utf-8') as fh:
            for r in csv.DictReader(fh):
                x = re.match(r'\d+', (r.get('numero') or '').strip())
                if x: m = max(m, int(x.group()))
    except FileNotFoundError: pass
    return m
with open(CPT + '.lock', 'w') as lk:
    fcntl.flock(lk, fcntl.LOCK_EX)
    try: cur = int(open(CPT).read().strip())
    except (FileNotFoundError, ValueError): cur = 0
    nxt = max(cur, dernier_journal()) + 1
    if '--peek' not in sys.argv:
        with open(CPT, 'w') as fh: fh.write(str(nxt))
    print(nxt)

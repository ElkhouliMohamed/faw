#!/usr/bin/env python3
"""Générateur de devis FAW (modèle automatique, à valider par Walfar).

Mise en page reprise des devis 606-616 (devis/t/gbat300.py et pdf616.py) :
logo, cadre client, date / PAGE / DEVIS N., tableau Qté / Désignation /
Prix Unitaire / Prix Total, Total HT / TVA 20% / Total TTC, mentions légales,
pied de page siège social.

Usage :
    python3 generer_devis.py devis.json [--png]

JSON attendu :
{
  "numero": 617,
  "date": "21/10/26",                    # optionnel, défaut = aujourd'hui (jj/mm/aa)
  "client": "Nom ou @handle",
  "telephone": "+212 6..",               # optionnel (affiché dans le cadre client)
  "ville": "Casablanca",
  "civilite": "Madame, Monsieur,",       # optionnel
  "lignes": [{"reference": "AUTO-GBAT300-230V", "qte": 1,
              "largeur_vantail_m": 2.2}],     # optionnel ; kit : > 2,5 => erreur
  "transport": {"mode": "retrait"}       # retrait | casablanca | rabat | autre | a_confirmer (autre ville, livraison à confirmer)
                                          # autre : {"mode":"autre","ville":"Tanger","montant":1200}
  "modele": false,                        # true = filigrane MODÈLE
  "sortie": "chemin/du.pdf"               # optionnel
}
Nom et prix TTC viennent UNIQUEMENT de produits-reference.csv (colonnes nom,
prix_ttc_mad). Référence ou prix absent => erreur, aucun PDF produit.
Paliers de prix quantité (décisions Walfar 21/10/2026) : colonnes
paliers_prix_ttc ("qte_min:prix;..." ex. "4:2000") et groupe_palier. La quantité
prise en compte est la somme des lignes du devis ayant le même groupe_palier
(ex. EI60-1V-2200 = portes 1 vantail 80/90/100 cm, tailles mélangées). Le palier
remplace le prix unitaire (pas de ligne de remise).
Transport identique pour tous les produits : Casablanca 400 DH, Rabat 800 DH,
retrait au dépôt de Lakhyayta gratuit, autre ville = montant donné par Walfar.
Les montants de transport sont considérés TTC.
"""
import csv, json, os, re, sys, datetime, subprocess
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4
from reportlab.lib.colors import blue, black, Color
from reportlab.lib.utils import simpleSplit

ICI = os.path.dirname(os.path.abspath(__file__))
CSV = os.path.join(ICI, '..', 'produits', 'produits-reference.csv')
LOGO = os.path.join(ICI, 'logo-faw.jpeg')   # copie de faw-whatsapp/devis/t/x/Data/image-23.jpeg
BUREAU = '21 Rue Al Yazidi Mohamed, Casablanca'   # bureau (pas le dépôt)
DEPOT = 'Lakhyayta'                              # dépôt / retrait (adresse exacte inconnue)
KIT_VANTAIL_MAX_M = 2.5
TRANSPORT = {'casablanca': ('Casablanca', 400.0), 'rabat': ('Rabat', 800.0)}

# Lignes de détail imprimées sous chaque article (texte fixe, modifiable ici).
def details(ref):
    if ref == 'AUTO-GBAT300-230V':
        return ['   Marque Genius, fabrication Italie. 230V, portail battant 2 vantaux.',
                '   2 moteurs (vantail droit et gauche), carte électronique, 2 télécommandes,',
                '   lampe clignotante et accessoires.',
                "   Pour portail battant jusqu'à 5 m au total (2,50 m maximum par vantail),",
                '   350 kg par vantail.',
                '   Garantie 1 an.']
    if ref == 'AUTO-A1000-KIT':
        return ['   Kit complet FAAC pour porte coulissante vitrée de 4,5 à 6 m.']
    m = re.match(r'CF-EI60-(\d+)', ref)
    if m:
        return ['   Acier galvanisé, laine de roche, joint intumescent. Hauteur 212,5 cm.',
                '   Poignée, cylindre, serrure et clés inclus. Blanc (proche RAL 9018).']
    m = re.match(r'GAL-(\d+)', ref)
    if m:
        return ['   Châssis 1 vantail pour cloison placo, passage %s x 2100 mm.' % m.group(1),
                '   2 chariots, frein ABS, guide inférieur, rail. Vantail (porte) non inclus.']
    if ref in EXT_DETAILS:
        return ['   ' + EXT_DETAILS[ref]]
    return []

# Une ligne de détail par extincteur / matériel incendie (tirée de la description
# de produits-reference.csv : type, capacité, classes). Tout produit de catégorie
# Incendie sans entrée ici => erreur (pas de devis incomplet).
EXT_DETAILS = {
    'EXT-PABC-6':     'Poudre polyvalente ABC, 6 kg. Classes A, B et C (solides, liquides, gaz).',
    'EXT-PABC-9':     'Poudre ABC, 9 kg. Classes A, B et C.',
    'EXT-PABC-50R':   'Poudre ABC, 50 kg, mobile sur roues. Classes A, B et C.',
    'EXT-AUTO-P6':    'Automatique à poudre ABC, 6 kg, déclenchement thermique, fixation plafond. Classes A, B et C.',
    'EXT-AUTO-P9':    'Automatique à poudre ABC, 9 kg, déclenchement thermique. Classes A, B et C.',
    'EXT-CO2-2':      'Dioxyde de carbone (CO2), 2 kg. Classe B et feux d\'origine électrique, sans résidu.',
    'EXT-CO2-5':      'Dioxyde de carbone (CO2), 5 kg. Classe B et feux d\'origine électrique, sans résidu.',
    'EXT-CO2-6':      'Dioxyde de carbone (CO2), 6 kg. Classe B et feux d\'origine électrique, sans résidu.',
    'EXT-EAU-6':      'Eau pulvérisée avec additif, 6 L. Classes A et B.',
    'EXT-EAU-9':      'Eau pulvérisée avec additif, 9 L. Classes A et B.',
    'EXT-RIA-30':     'Robinet d\'incendie armé mural, tuyau semi-rigide 30 m. Classe A.',
    'EXT-POTEAU':     'Poteau incendie extérieur raccordé au réseau d\'eau. Classe A.',
    'EXT-MOUSSE-140': 'Chariot mobile à mousse, 140 L. Classes A et B (feux d\'hydrocarbures).',
}

TITRES = {'Automatisme': "Fourniture d'un kit de motorisation pour portail battant",
          'Portes coupe-feu': 'Fourniture des portes Coupe-Feu EI 60',
          'Portes coulissantes encastrables': 'Fourniture de châssis pour portes coulissantes encastrables',
          'Incendie': 'Fourniture de matériel de lutte contre l\'incendie'}

TITRES_REF = {'AUTO-A1000-KIT': "Fourniture d'un kit d'automatisme pour porte coulissante vitrée"}

# Garde-fous texte : mots / marques interdits sur un devis.
INTERDITS = [r'(?i)secours', r'(?i)\b600\s*kg', r'(?i)novoferm', r'(?i)alsal',  # 'faac' retiré le 21/10/2026 : marque FAAC autorisée par Walfar (kit A1000)
             r'(?i)inther', r'\bALFA\b', r'\bBASIC\b', r'(?i)\btesa\b', r'(?i)zodiac',
             r'(?i)flexidoor', r'(?i)kingber', r'(?i)metalbond', r'(?i)ghazala',
             r'(?i)nejmet', r'(?i)sirar', r'(?i)installation (offerte|gratuite|incluse)',
             r'(?i)pose (offerte|gratuite|incluse)', r'(?i)remise']

class Erreur(Exception): pass

def f(x): return f"{x:,.2f}".replace(',', ' ').replace('.', ',').replace(' ', '.')

def charger_produits():
    with open(CSV, newline='', encoding='utf-8') as fh:
        return {r['reference'].strip(): r for r in csv.DictReader(fh)}

def paliers(p, ref):
    """'4:2000;10:1900' -> [(4, 2000.0), (10, 1900.0)] trié."""
    out = []
    for part in (p.get('paliers_prix_ttc') or '').split(';'):
        part = part.strip()
        if not part: continue
        try: q, px = part.split(':'); out.append((int(q), float(px.replace(',', '.'))))
        except ValueError: raise Erreur(f'palier de prix invalide pour {ref} : {part!r}')
        if out[-1][0] < 2 or out[-1][1] <= 0: raise Erreur(f'palier de prix invalide pour {ref} : {part!r}')
    return sorted(out)

def largeur_m(v, ref):
    try: return float(str(v).replace(',', '.'))
    except ValueError: raise Erreur(f'largeur_vantail_m invalide pour {ref} : {v!r}')

def calculer(d):
    P = charger_produits()
    lignes = []
    if not d.get('lignes'): raise Erreur('aucune ligne')
    for l in d['lignes']:
        ref = str(l.get('reference', '')).strip(); q = l.get('qte', l.get('qty'))
        if ref not in P: raise Erreur(f'référence inconnue dans produits-reference.csv : {ref!r}')
        p = P[ref]; nom = (p.get('nom') or '').strip(); px = (p.get('prix_ttc_mad') or '').strip()
        if not nom: raise Erreur(f'nom manquant pour {ref}')
        try: ttc = float(px.replace(' ', '').replace(',', '.'))
        except ValueError: raise Erreur(f'prix TTC manquant ou invalide pour {ref} : {px!r}')
        if ttc <= 0: raise Erreur(f'prix TTC nul pour {ref}')
        if not isinstance(q, int) or isinstance(q, bool) or q <= 0: raise Erreur(f'quantité invalide pour {ref} : {q!r}')
        if ref.startswith('AUTO-GBAT300'):
            for v in (l.get('largeur_vantail_m'), d.get('largeur_vantail_m')):
                if v is not None and largeur_m(v, ref) > KIT_VANTAIL_MAX_M:
                    raise Erreur(f'kit G-BAT 300 : largeur_vantail_m {v} > 2,5 m (2,50 m maximum par vantail) ; devis refusé, voir Walfar')
        if p.get('categorie', '') == 'Incendie' and ref not in EXT_DETAILS:
            raise Erreur(f'ligne de détail extincteur manquante pour {ref} (EXT_DETAILS)')
        lignes.append(dict(ref=ref, nom=nom, qte=q, pu_ttc=ttc, pu_base=ttc, palier=None,
                           cat=p.get('categorie', ''), paliers=paliers(p, ref),
                           groupe=(p.get('groupe_palier') or '').strip() or ref))
        # Prix/nom/détails fixés par Walfar pour ce devis (sur son ordre explicite uniquement)
        if l.get('prix_ttc_walfar') is not None:
            lignes[-1]['pu_ttc'] = float(l['prix_ttc_walfar']); lignes[-1]['paliers'] = []; lignes[-1]['fixe'] = True
        if l.get('nom'): lignes[-1]['nom'] = str(l['nom'])
        if l.get('details') is not None: lignes[-1]['details'] = list(l['details'])
    # paliers quantité : quantité totale du groupe sur tout le devis
    qg = {}
    for l in lignes: qg[l['groupe']] = qg.get(l['groupe'], 0) + l['qte']
    for l in lignes:
        for qmin, px in l['paliers']:
            if qg[l['groupe']] >= qmin: l['pu_ttc'], l['palier'] = px, qmin
    t = d.get('transport') or {}; mode = str(t.get('mode', '')).lower()
    if mode in TRANSPORT:
        ville, mt = TRANSPORT[mode]
    elif mode == 'autre':
        ville = str(t.get('ville') or d.get('ville') or '').strip()
        try: mt = float(t['montant'])
        except (KeyError, TypeError, ValueError): raise Erreur('transport "autre" : montant (fixé par Walfar) obligatoire')
        if mt <= 0 or not ville: raise Erreur('transport "autre" : ville et montant > 0 obligatoires')
    elif mode == 'retrait':
        ville, mt = None, 0.0
    elif mode in ('a_confirmer', 'option'):
        ville = str(t.get('ville') or d.get('ville') or '').strip(); mt = 0.0
    else: raise Erreur('transport.mode doit être retrait | casablanca | rabat | autre | a_confirmer')
    total = round(sum(l['qte'] * l['pu_ttc'] for l in lignes) + mt, 2)
    ht = round(total / 1.2, 2); tva = round(total - ht, 2)
    return lignes, (mode, ville, mt), (ht, tva, total)

def construire_lignes(d, lignes, transp):
    cats = {l['cat'] for l in lignes}
    titre = TITRES.get(cats.pop()) if len(cats) == 1 else 'Fourniture des articles suivants'
    refs = {l['ref'] for l in lignes}
    if refs & TITRES_REF.keys(): titre = TITRES_REF[next(iter(refs))] if len(refs) == 1 else 'Fourniture des articles suivants'
    titre = d.get('titre') or titre or 'Fourniture des articles suivants'
    r = [('', d.get('civilite', 'Madame, Monsieur,'), None, None),
         ('', 'Suite à votre demande de prix, nous avons le plaisir de vous faire parvenir', None, None),
         ('', 'notre meilleure offre pour :', None, None), ('', '', None, None),
         ('', '#U' + titre, None, None), ('', '', None, None),
         ('', '#BDésignation', None, None), ('', '', None, None)]
    for l in lignes:
        pu = l['pu_ttc'] / 1.2
        r.append((str(l['qte']), l['nom'], pu, pu * l['qte']))
        r += [('', s, None, None) for s in (l['details'] if 'details' in l else details(l['ref']))]
        tier = f" (tarif à partir de {l['palier']} unités)" if l['palier'] else ''
        r.append(('', f"   Prix unitaire : {f(l['pu_ttc'])} DH TTC{tier}.", None, None))
        r.append(('', '', None, None))
    mode, ville, mt = transp
    if mt:
        r.append(('1', f'Transport / livraison {ville}', mt / 1.2, mt / 1.2))
        r.append(('', f'   Montant : {f(mt)} DH TTC (tarif indicatif, susceptible de varier).', None, None))
        r.append(('', '', None, None))
    _ttc = sum(l['pu_ttc'] * l['qte'] for l in lignes) + (mt or 0)
    r.append(('', f"#BTotal TTC : {f(_ttc)} DH  (Total HT {f(_ttc / 1.2)} + TVA 20% {f(_ttc - _ttc / 1.2)})", None, None))
    r.append(('', '', None, None))
    if mode == 'option':
        _o = float((d.get('transport') or {}).get('montant') or 0)
        r.append(('', f'Option livraison {ville} : {f(_o)} DH TTC, non incluse dans le total (tarif indicatif).', None, None))
        r.append(('', '', None, None))
    elif mode == 'a_confirmer':
        r.append(('', (f'Livraison {ville} : à confirmer (non incluse dans le total).' if ville else 'Livraison : à confirmer (non incluse dans le total).'), None, None))
        r.append(('', '', None, None))
    r.append(('', 'Fourniture seule, installation non incluse.', None, None))
    if mt or mode in ('a_confirmer', 'option'): r.append(('', f'Ou retrait au dépôt de {DEPOT} (gratuit).', None, None))
    else: r.append(('', f'Retrait au dépôt de {DEPOT} (gratuit).', None, None))
    r += [('', '', None, None),
          ('', '#UVALIDITE DU DEVIS', None, None), ('', 'Ce devis est valable 14 jours à compter de sa date', None, None),
          ('', '#UMODE DE REGLEMENT.', None, None), ('', 'Par virement ou chèque encaissé avant retrait de la marchandise', None, None),
          ('', '', None, None), ('', '#BN.B.', None, None),
          ('', '*Toute commande sans BON DE COMMANDE ne sera prise en compte', None, None),
          ('', "* La marchandise reste la propriété de la société FAW jusqu'au règlement", None, None),
          ('', 'définitif de la facture', None, None), ('', '', None, None),
          ('', '*Tous les chèques doivent être libellés non endossable au nom', None, None),
          ('', 'de la société FAW', None, None)]
    return r

def verifier_texte(textes):
    for s in textes:
        for pat in INTERDITS:
            if re.search(pat, s): raise Erreur(f'texte interdit ({pat}) dans : {s!r}')

def generer(d):
    lignes, transp, (ht, tva, ttc) = calculer(d)
    num = d.get('numero'); client = str(d.get('client', '')).strip()
    if not num or not client: raise Erreur('numero et client obligatoires')
    date = d.get('date') or datetime.date.today().strftime('%d/%m/%y')
    rows = construire_lignes(d, lignes, transp)
    mode, tville, mt = transp
    info = []
    if d.get('projet'): info.append(str(d['projet']))
    if d.get('ice'): info.append('ICE : ' + str(d['ice']))
    if d.get('telephone'): info.append('WhatsApp : ' + str(d['telephone']))
    if mt: info.append('Livraison : ' + tville)
    elif mode == 'option': info.append('Livraison : ' + tville + ' (en option)')
    elif mode == 'a_confirmer': info.append(('Livraison : ' + tville + ' (à confirmer)') if tville else 'Livraison : à confirmer')
    elif d.get('ville'): info.append('Ville : ' + str(d['ville']))
    verifier_texte([client] + info + [x[1] for x in rows])
    slug = re.sub(r'[^A-Za-z0-9]+', '-', client).strip('-') or 'client'
    out = d.get('sortie') or os.path.join(ICI, f'Devis-{num}-{slug}.pdf')

    W, H = A4; c = canvas.Canvas(out, pagesize=A4)
    c.setTitle(f'Devis {num} - {client}' + (' (MODÈLE)' if d.get('modele') else ''))
    c.setAuthor('FAW S.A.R.L')
    L, R = 40, W - 40; cq, cd, cp, ct = L, L + 35, R - 175, R - 90; rh = 12.5
    # découpe des lignes de désignation trop longues
    flat = []
    for q, dsc, pu, pt in rows:
        if dsc.startswith('#'): flat.append((q, dsc, pu, pt)); continue
        ind = len(dsc) - len(dsc.lstrip(' '))
        parts = simpleSplit(dsc.strip(), 'Helvetica', 7.5, cp - cd - 10 - ind * 2) or ['']
        for i, s in enumerate(parts):
            flat.append((q if i == 0 else '', ' ' * ind + s, pu if i == 0 else None, pt if i == 0 else None))
    top0 = H - 191; bas = 100; cap_last = int((top0 - rh - bas - 3 * rh) / rh); cap = int((top0 - rh - bas) / rh)
    pages = []; rest = flat
    while len(rest) > cap_last:
        pages.append(rest[:cap]); rest = rest[cap:]
    pages.append(rest)

    def entete(page):
        c.drawImage(LOGO, L + 20, H - 110, width=175, height=70)
        c.roundRect(R - 235, H - 150, 235, 58, 8)
        ny = H - 112 if len(info) < 2 else H - 108; fs = 13
        while c.stringWidth(client, 'Helvetica-Bold', fs) > 220: fs -= .5
        c.setFont('Helvetica-Bold', fs); c.drawCentredString(R - 117, ny, client); c.setFont('Helvetica', 9)
        for i, s in enumerate(info): c.drawCentredString(R - 117, ny - 15 - 13 * i, s)
        y = H - 185
        c.roundRect(L, y, 90, 24, 6); c.setFont('Helvetica', 12); c.drawCentredString(L + 45, y + 8, date)
        c.roundRect(L + 95, y, 95, 24, 6); c.setFont('Helvetica-Bold', 8); c.drawString(L + 110, y + 14, 'PAGE')
        c.setFont('Helvetica', 8); c.drawString(L + 115, y + 4, f'{page}' if len(pages) == 1 else f'{page}/{len(pages)}')
        c.roundRect(L + 195, y, R - L - 195, 24, 6); c.setFont('Helvetica-Bold', 8); c.drawString(L + 330, y + 14, 'DEVIS   N.')
        c.setFont('Helvetica', 8); c.drawString(L + 340, y + 4, str(num))
    def pied():
        c.setFillColor(black); c.setFont('Helvetica', 8.5)
        c.drawString(cd + 4, 70, 'Siège social : FAW S.A.R.L, 22 RUE DE RHODES RDC APP M3 - Casablanca-Maroc')
        c.setFillColor(blue); c.drawString(cd + 40, 57, 'Tel : 05 22 86 52 02 / 05 22 86 52 72  E-mail :faw@faw.ma')
        c.setFillColor(black); c.setFont('Helvetica', 7.5)
        c.drawString(cd + 4, 45, f'Bureau : {BUREAU}  -  Dépôt (retrait) : {DEPOT}')
        c.setFillColor(black)
    def filigrane():
        if not d.get('modele'): return
        c.saveState(); c.setFillColor(Color(0.85, 0.1, 0.1, alpha=0.18)); c.setFont('Helvetica-Bold', 110)
        c.translate(W / 2, H / 2 - 40); c.rotate(40); c.drawCentredString(0, 0, 'MODÈLE'); c.restoreState()
        c.saveState(); c.setFillColor(Color(0.8, 0, 0)); c.setFont('Helvetica-Bold', 9)
        c.drawCentredString(W / 2, 30, 'MODÈLE - exemple non contractuel, à valider par Walfar - ne pas envoyer'); c.restoreState()

    for pi, prow in enumerate(pages, 1):
        entete(pi); top = top0
        c.setLineWidth(1); c.setFont('Helvetica-Bold', 7); c.rect(L, top - rh, R - L, rh)
        for x, s in [(cq + 17, 'Qté'), ((cd + cp) / 2, 'Désignation'), ((cp + ct) / 2, 'Prix Unitaire'), ((ct + R) / 2, 'Prix Total')]:
            c.drawCentredString(x, top - rh + 4, s)
        yy = top - rh
        for q, dsc, pu, pt in prow:
            yy -= rh; c.setFont('Helvetica', 7.5); c.drawString(cq + 4, yy + 4, q)
            if dsc.startswith('#U'):
                s = dsc[2:]; c.setFont('Helvetica-Bold', 8); c.drawString(cd + 4, yy + 4, s)
                c.line(cd + 4, yy + 2.5, cd + 4 + c.stringWidth(s, 'Helvetica-Bold', 8), yy + 2.5)
            elif dsc.startswith('#B'): c.setFont('Helvetica-Bold', 8); c.drawString(cd + 4, yy + 4, dsc[2:])
            else: c.drawString(cd + 4, yy + 4, dsc)
            c.setFont('Helvetica', 7.5)
            if pu is not None: c.drawRightString(ct - 6, yy + 4, f(pu))
            if pt is not None: c.drawRightString(R - 6, yy + 4, f(pt))
        c.setLineWidth(.8)
        for x in (L, cd, cp, ct, R): c.line(x, top, x, yy)
        c.line(L, yy, R, yy)
        if pi == len(pages):
            c.setFont('Helvetica-Bold', 8)
            for lab, v in [('Total HT', ht), ('TVA 20%', tva), ('Total TTC', ttc)]:
                c.rect(cp, yy - rh, R - cp, rh); c.line(ct, yy, ct, yy - rh)
                c.drawString(cp + 4, yy - rh + 4, lab); c.drawRightString(R - 6, yy - rh + 4, f(v)); yy -= rh
        pied(); filigrane(); c.showPage()
    c.save()
    return out, (ht, tva, ttc)

def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    if len(args) != 1: print(__doc__); sys.exit(2)
    with open(args[0], encoding='utf-8') as fh: d = json.load(fh)
    try: out, (ht, tva, ttc) = generer(d)
    except Erreur as e: print('ERREUR :', e, file=sys.stderr); sys.exit(1)
    print(f'{out}\nTotal HT {f(ht)} | TVA 20% {f(tva)} | Total TTC {f(ttc)} DH')
    if '--png' in sys.argv:
        base = out[:-4]; subprocess.run(['pdftoppm', '-r', '100', '-png', '-f', '1', '-l', '1', '-singlefile', out, base], check=True)
        print(base + '.png')

if __name__ == '__main__': main()

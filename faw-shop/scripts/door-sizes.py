"""Portes coupe-feu EI60 : un visuel par taille, à l'échelle (v7).
Sources (photos FAW) : assets/photos-originales/door-1v-cutout.png (photo de la porte 1 vantail 100 cm, détourée)
et door-2v-cutout.png (photo de la porte 2 vantaux 140 cm, détourée).
1. Redressement perspective (4 coins du cadre -> rectangle au vrai ratio largeur / 212,5 cm).
2. Tailles photographiées (100 cm 1V, 140 cm 2V) : photo redressée telle quelle.
   Autres tailles : on élargit / rétrécit uniquement la zone lisse des vantaux ; cadre, poignée, paumelles
   et battement restent ceux de la photo. 2 vantaux : vantaux symétriques (le catalogue ne précise pas d'inégalité).
3. Toutes les portes à la même échelle (5 px/cm) dans le cadre packshot 4:5, même fond et ombre,
   deux cotes séparées (flèche horizontale : largeur seule ; flèche verticale : 212,5 cm)
   et mention « illustration non contractuelle ».
Usage : python3 scripts/door-sizes.py  -> public/images/products/v7-2/CF-EI60-*.jpg"""
import os, sys, math
import cv2, numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from packshots import background, W, H, ROOT  # même fond « lin » que les autres packshots

SRC = f"{ROOT}/assets/photos-originales/"
OUT = f"{ROOT}/public/images/products/v7-2/"
HEIGHT_CM = 212.5
RH = 1700            # hauteur de travail du redressement (px)
PX_CM = 5.0          # échelle commune : 200 cm -> 1000 px
FLOOR = 1290         # bas des portes
FONT = "/usr/share/fonts/truetype/sand-box/google/Be Vietnam Pro/BeVietnamPro-Medium.ttf"
FONT_L = "/usr/share/fonts/truetype/sand-box/google/Be Vietnam Pro/BeVietnamPro-Regular.ttf"
INK = (92, 72, 54)

def rectify(path, width_cm, thr=24):
    im = np.array(Image.open(path).convert("RGBA"))
    m = cv2.morphologyEx((im[:, :, 3] > thr).astype(np.uint8) * 255, cv2.MORPH_OPEN, np.ones((5, 5), np.uint8))
    c = max(cv2.findContours(m, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)[0], key=cv2.contourArea)
    hull = cv2.convexHull(c); peri = cv2.arcLength(hull, True)
    for e in np.linspace(0.01, 0.1, 40):
        ap = cv2.approxPolyDP(hull, e * peri, True)
        if len(ap) == 4: break
    else: raise SystemExit(f"coins introuvables : {path}")
    p = ap.reshape(-1, 2).astype(np.float32); s = p.sum(1); d = p[:, 0] - p[:, 1]
    src = np.array([p[np.argmin(s)], p[np.argmax(d)], p[np.argmax(s)], p[np.argmin(d)]], np.float32)
    rw = round(RH * width_cm / HEIGHT_CM)
    M = cv2.getPerspectiveTransform(src, np.array([[0, 0], [rw, 0], [rw, RH], [0, RH]], np.float32))
    out = cv2.warpPerspective(im, M, (rw, RH), flags=cv2.INTER_LANCZOS4, borderMode=cv2.BORDER_CONSTANT, borderValue=(0, 0, 0, 0))
    out[:, :, 3] = np.where(out[:, :, 3] > 200, 255, out[:, :, 3])  # bords nets, pas de trous dans le cadre
    return Image.fromarray(out)

def stretch(img, x0, x1, new_w):
    """Redimensionne horizontalement la bande [x0, x1) (panneau lisse) ; le reste est conservé tel quel."""
    left, mid, right = img.crop((0, 0, x0, img.height)), img.crop((x0, 0, x1, img.height)), img.crop((x1, 0, img.width, img.height))
    mid = mid.resize((max(8, new_w), img.height), Image.LANCZOS)
    out = Image.new("RGBA", (left.width + mid.width + right.width, img.height))
    out.paste(left, (0, 0)); out.paste(mid, (left.width, 0)); out.paste(right, (left.width + mid.width, 0))
    return out

def door_1v(base, width_cm):
    # base : 100 cm redressée (800 px). Zone lisse entre le cadre gauche (paumelles) et la poignée.
    tw = round(RH * width_cm / HEIGHT_CM)
    if tw == base.width: return base
    x0, x1 = round(base.width * 0.15), round(base.width * 0.81)
    return stretch(base, x0, x1, (x1 - x0) + tw - base.width)

def door_2v(base, width_cm):
    # base : 140 cm redressée (1120 px). Battement (jonction des vantaux) détecté sur le profil de colonnes.
    tw = round(RH * width_cm / HEIGHT_CM)
    if tw == base.width: return base
    g = np.array(base.convert("L"), float)[int(RH * 0.2):int(RH * 0.8)].mean(0)
    Wb = base.width; stile = int(np.argmin(g[int(Wb * 0.3):int(Wb * 0.6)])) + int(Wb * 0.3)
    fl, fr = round(Wb * 0.035), round(Wb * 0.027)       # montants du cadre
    leaf_l, leaf_r = stile - fl, Wb - fr - stile          # vantaux photographiés (inégaux)
    target = (tw - fl - fr) / 2                            # vantaux symétriques
    # zones lisses : vantail gauche loin du battement, vantail droit après la poignée
    l0, l1 = fl + round(leaf_l * 0.10), fl + round(leaf_l * 0.85)
    r0, r1 = stile + round(leaf_r * 0.18), stile + round(leaf_r * 0.92)
    img = stretch(base, r0, r1, (r1 - r0) + round(target - leaf_r))
    return stretch(img, l0, l1, (l1 - l0) + round(target - leaf_l))

# Marge à droite réservée à la cote verticale (étiquette tournée + flèche).
DIM_RIGHT = 110
GAP = 52          # bord droit de la porte → ligne de cote verticale
LABEL_BG = (245, 241, 235, 255)
LINE = INK + (170,)
TEXT = INK + (255,)

def _unit(x0, y0, x1, y1):
    L = math.hypot(x1 - x0, y1 - y0) or 1
    return (x1 - x0) / L, (y1 - y0) / L

def _arrowhead(d, tip, dx, dy, size, col):
    """Pointe d'une flèche : (dx, dy) est le vecteur unitaire vers la pointe."""
    tx, ty = tip
    bx, by = tx - dx * size, ty - dy * size
    px, py = -dy, dx
    w = size * 0.42
    d.polygon([(tx, ty), (bx + px * w, by + py * w), (bx - px * w, by - py * w)], fill=col)

def dim_line(d, a, b, col=LINE, width=2, head=12):
    """Ligne de cote avec une flèche à chaque extrémité (les pointes collent à a et b)."""
    x0, y0 = a
    x1, y1 = b
    dx, dy = _unit(x0, y0, x1, y1)
    d.line((x0 + dx * (head - 1), y0 + dy * (head - 1), x1 - dx * (head - 1), y1 - dy * (head - 1)), fill=col, width=width)
    _arrowhead(d, (x0, y0), -dx, -dy, head, col)
    _arrowhead(d, (x1, y1), dx, dy, head, col)

def paste_label(canvas, text, cx, cy, font, fill=TEXT, angle=0, pad=12, bg=LABEL_BG):
    dummy = ImageDraw.Draw(canvas)
    bb = dummy.textbbox((0, 0), text, font=font)
    tw, th = bb[2] - bb[0], bb[3] - bb[1]
    im = Image.new("RGBA", (tw + pad * 2, th + pad * 2), bg)
    ImageDraw.Draw(im).text((pad - bb[0], pad - bb[1]), text, font=font, fill=fill)
    if angle:
        im = im.rotate(angle, expand=True, resample=Image.Resampling.BICUBIC)
    canvas.alpha_composite(im, (round(cx - im.width / 2), round(cy - im.height / 2)))

def compose(door, width_cm):
    c = background()
    w = round(width_cm * PX_CM)
    h = round(HEIGHT_CM * PX_CM)
    s = door.resize((w, h), Image.LANCZOS)
    # Le groupe porte + cote verticale est centré : la flèche de hauteur reste dans le cadre, y compris à 200 cm.
    x = (W - w - DIM_RIGHT) // 2
    y = FLOOR - h
    sh = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(sh)
    d.ellipse((x + w * 0.03, y + h - 12, x + w * 0.97, y + h + 20), fill=(60, 40, 20, 70))
    sh = sh.filter(ImageFilter.GaussianBlur(16))
    drop = Image.new("RGBA", s.size, (60, 40, 20, 255))
    drop.putalpha(s.split()[3].point(lambda v: int(v * 0.10)))
    layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    layer.alpha_composite(drop, (x + 14, y + 10))
    layer = layer.filter(ImageFilter.GaussianBlur(18))
    c.alpha_composite(sh)
    c.alpha_composite(layer)
    c.alpha_composite(s, (x, y))

    d = ImageDraw.Draw(c)
    # --- largeur : traits de rappel depuis le bas du cadre, flèche horizontale, libellé « L cm » ---
    ly = FLOOR + 52
    d.line((x, FLOOR + 6, x, ly + 10), fill=LINE, width=2)
    d.line((x + w, FLOOR + 6, x + w, ly + 10), fill=LINE, width=2)
    dim_line(d, (x, ly), (x + w, ly))
    f = ImageFont.truetype(FONT, 34)
    paste_label(c, f"{width_cm:g} cm".replace(".", ","), x + w / 2, ly, f)

    # --- hauteur : traits de rappel depuis le haut et le bas du cadre, flèche verticale, « 212,5 cm » ---
    lx = x + w + GAP
    d.line((x + w + 6, y, lx + 10, y), fill=LINE, width=2)
    d.line((x + w + 6, y + h, lx + 10, y + h), fill=LINE, width=2)
    dim_line(d, (lx, y), (lx, y + h))
    paste_label(c, "212,5 cm", lx, y + h / 2, f, angle=90)

    f2 = ImageFont.truetype(FONT_L, 24)
    note = "Illustration non contractuelle"
    nb = d.textbbox((0, 0), note, font=f2)
    d.text(((W - (nb[2] - nb[0])) // 2, H - 70), note, font=f2, fill=INK + (130,))
    return c.convert("RGB")

SIZES_1V = {80: "CF-EI60-80", 90: "CF-EI60-90", 100: "CF-EI60-100", 110: "CF-EI60-110", 120: "CF-EI60-120-1V"}
SIZES_2V = {120: "CF-EI60-120-2V", 140: "CF-EI60-140-2V", 160: "CF-EI60-160-2V", 180: "CF-EI60-180-2V", 200: "CF-EI60-200-2V"}
REAL = {"CF-EI60-100", "CF-EI60-140-2V"}  # tailles photographiées

def filename(pid): return f"{pid}-{'photo' if pid in REAL else 'echelle'}.jpg"

if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    b1 = rectify(SRC + "door-1v-cutout.png", 100); b2 = rectify(SRC + "door-2v-cutout.png", 140)
    for cm, pid in SIZES_1V.items():
        compose(door_1v(b1, cm), cm).save(OUT + filename(pid), quality=86, optimize=True, progressive=True)
    for cm, pid in SIZES_2V.items():
        compose(door_2v(b2, cm), cm).save(OUT + filename(pid), quality=86, optimize=True, progressive=True)
    for pid in [*SIZES_1V.values(), *SIZES_2V.values()]: print(pid, f"/images/products/v7-2/{filename(pid)}")

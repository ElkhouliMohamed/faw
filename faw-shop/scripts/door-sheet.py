"""Planche contact des 10 visuels portes coupe-feu + contrôle dHash (aucune taille ne partage une image)."""
import os, sys, itertools
import numpy as np
from PIL import Image, ImageDraw, ImageFont
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from importlib import import_module
ds = import_module("door-sizes")
ROOT = ds.ROOT
ids = [*ds.SIZES_1V.values(), *ds.SIZES_2V.values()]
paths = [f"{ds.OUT}{ds.filename(i)}" for i in ids]
def dhash(p, n=16):
    g = np.array(Image.open(p).convert("L").resize((n + 1, n), Image.LANCZOS), float)
    return (g[:, 1:] > g[:, :-1]).flatten()
hs = [dhash(p) for p in paths]
worst = min((int((a != b).sum()), ids[i], ids[j]) for (i, a), (j, b) in itertools.combinations(enumerate(hs), 2))
print("dHash 256 bits, plus petite distance entre deux tailles :", worst)
# largeur réelle de la porte dans chaque image (pixels qui diffèrent du fond) -> doit valoir L cm × 5 px/cm
bg = np.array(ds.background().convert("L"), float)
sizes = {**{v: k for k, v in ds.SIZES_1V.items()}, **{v: k for k, v in ds.SIZES_2V.items()}}
bad = 0
for pid, p in zip(ids, paths):
    g = np.array(Image.open(p).convert("L"), float); y0, y1 = ds.FLOOR - 900, ds.FLOOR - 300
    # masquer la cote verticale (flèche + libellé à droite de la porte)
    w_door = int(sizes[pid] * ds.PX_CM)
    x_door = (ds.W - w_door - ds.DIM_RIGHT) // 2
    g[:, x_door + w_door - 2:] = bg[:, x_door + w_door - 2:]
    cols = np.where((np.abs(g[y0:y1] - bg[y0:y1]) > 12).mean(0) > 0.5)[0]
    wpx = int(cols.max() - cols.min() + 1); exp = sizes[pid] * ds.PX_CM
    ok = abs(wpx - exp) <= 10  # +7-9 px constants = ombre portée à droite
    bad += not ok
    print(f"{pid:16} {sizes[pid]:>3} cm  porte {wpx:>4} px (attendu {exp:.0f})  {'ok' if ok else 'ÉCART'}")
tw, th, lab = 300, 375, 44
sheet = Image.new("RGB", (tw * 5, (th + lab) * 2), (255, 255, 255)); d = ImageDraw.Draw(sheet)
f = ImageFont.truetype(ds.FONT, 15)
for k, (pid, p) in enumerate(zip(ids, paths)):
    x, y = (k % 5) * tw, (k // 5) * (th + lab)
    sheet.paste(Image.open(p).resize((tw, th), Image.LANCZOS), (x, y))
    d.text((x + 12, y + th + 10), f"{pid} · {'photo FAW' if pid in ds.REAL else 'visuel à l’échelle'}", font=f, fill=(60, 45, 30))
out = f"{ROOT}/shots/v6/portes-mesures-planche.png"; sheet.save(out); print(out)
sys.exit(0 if worst[0] > 4 and not bad else 1)

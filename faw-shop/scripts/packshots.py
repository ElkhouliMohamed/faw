"""Packshots FAW v6 : sujet détouré, centré, posé sur un fond clair uniforme (4:5, 1200×1500).
Sources : assets/photos-originales (photos FAW du catalogue) + détourages /tmp/cut (rembg isnet / birefnet).
Usage : python3 scripts/packshots.py  → écrit public/images/products/<ID>.jpg (next/image sert AVIF/WebP)."""
from PIL import Image, ImageFilter, ImageDraw
import numpy as np, os
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = f"{ROOT}/assets/photos-originales/"; CUT = "/tmp/cut/"; OUT = f"{ROOT}/public/images/products/v6/"
W, H = 1200, 1500
BG_TOP, BG_BOT = (250, 248, 245), (240, 235, 228)   # fond « lin » #FAF8F5 → #F0EBE4

def background():
    y = np.linspace(0, 1, H)[:, None, None]
    top, bot = np.array(BG_TOP, float), np.array(BG_BOT, float)
    g = top + (bot - top) * (y ** 1.6)
    g = np.repeat(g, W, axis=1)
    # vignette radiale très douce + grain fin (évite le banding)
    yy, xx = np.mgrid[0:H, 0:W]
    r = np.sqrt(((xx - W / 2) / W) ** 2 + ((yy - H * 0.42) / H) ** 2)
    g = g * (1 - 0.035 * np.clip(r * 1.6, 0, 1))[:, :, None]
    g += np.random.default_rng(6).normal(0, 1.1, g.shape)
    return Image.fromarray(np.clip(g, 0, 255).astype(np.uint8)).convert("RGBA")

def load_cut(name, thr=24):
    im = Image.open(CUT + name).convert("RGBA") if os.path.exists(CUT + name) else Image.open(SRC + name).convert("RGBA")
    a = np.array(im); al = a[:, :, 3]; al[al < thr] = 0; a[:, :, 3] = al
    im = Image.fromarray(a); return im.crop(im.getbbox())

def compose(subj, box_w=0.74, box_h=0.78, floor=0.89):
    c = background()
    sc = min(W * box_w / subj.width, H * box_h / subj.height)
    s = subj.resize((max(1, round(subj.width * sc)), max(1, round(subj.height * sc))), Image.LANCZOS)
    x = (W - s.width) // 2; y = round(H * floor) - s.height
    # ombre de contact (ellipse floue) + ombre portée légère
    sh = Image.new("RGBA", (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(sh)
    d.ellipse((x + s.width * 0.04, y + s.height - 14, x + s.width * 0.96, y + s.height + 22), fill=(60, 40, 20, 70))
    sh = sh.filter(ImageFilter.GaussianBlur(16))
    drop = Image.new("RGBA", s.size, (60, 40, 20, 255)); drop.putalpha(s.split()[3].point(lambda v: int(v * 0.10)))
    layer = Image.new("RGBA", (W, H), (0, 0, 0, 0)); layer.alpha_composite(drop, (x + 14, y + 10)); layer = layer.filter(ImageFilter.GaussianBlur(18))
    c.alpha_composite(sh); c.alpha_composite(layer); c.alpha_composite(s, (x, y))
    return c.convert("RGB")

def cover(name, focus=0.5):
    im = Image.open(SRC + name).convert("RGB"); r = W / H
    if im.width / im.height > r:
        nw = round(im.height * r); l = round((im.width - nw) * focus); im = im.crop((l, 0, l + nw, im.height))
    else:
        nh = round(im.width / r); t = (im.height - nh) // 2; im = im.crop((0, t, im.width, t + nh))
    return im.resize((W, H), Image.LANCZOS)

def save(im, ids):
    for i in ids:
        im.save(OUT + f"{i}.jpg", quality=86, optimize=True, progressive=True)

if __name__ == "__main__":
    door1 = compose(load_cut("door-1v-cutout.png"), box_w=0.62, box_h=0.80)
    save(door1, ["CF-EI60-80", "CF-EI60-90", "CF-EI60-100", "CF-EI60-110", "CF-EI60-120-1V"])
    door2 = compose(load_cut("CF-EI60-120-2V.png"), box_w=0.78, box_h=0.80)
    save(door2, ["CF-EI60-120-2V", "CF-EI60-140-2V", "CF-EI60-160-2V", "CF-EI60-180-2V", "CF-EI60-200-2V"])
    save(compose(load_cut("EXT-CO2-2.png"), box_w=0.62, box_h=0.74), ["EXT-CO2-2", "EXT-CO2-5", "EXT-CO2-6"])
    save(compose(load_cut("EXT-PABC-6.png"), box_w=0.70, box_h=0.70), ["EXT-PABC-6", "EXT-PABC-9"])
    save(compose(load_cut("EXT-EAU-6.png"), box_w=0.56, box_h=0.72), ["EXT-EAU-6", "EXT-EAU-9"])
    save(compose(load_cut("EXT-POTEAU.png"), box_w=0.50, box_h=0.76), ["EXT-POTEAU"])
    save(compose(load_cut("AUTO-GBAT300-230V.png"), box_w=0.84, box_h=0.70, floor=0.84), ["AUTO-GBAT300-230V"])
    # galandage : photo d'ambiance, recadrée au même format 4:5
    save(cover("GAL-800.jpg", 0.5), ["GAL-600", "GAL-700", "GAL-800", "GAL-900", "GAL-1000"])
    # 2e vue 2 vantaux (galerie)
    if os.path.exists(CUT + "CF-EI60-2V-photo-02.png"):
        compose(load_cut("CF-EI60-2V-photo-02.png"), box_w=0.78, box_h=0.80).save(f"{ROOT}/public/images/alt/v6/CF-EI60-2V-photo-02.jpg", quality=86, optimize=True, progressive=True)
    print("ok")

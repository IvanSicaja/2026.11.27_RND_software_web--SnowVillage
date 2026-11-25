# Erzeugt ruhige, monochrome Platzhalter-Landschaften (Berg, Stein, Wasser, Holz).
# Aufruf (im Ordner main/):  python scripts/platzhalter_bilder.py public/images
# Abhängigkeiten: siehe draft_requirements_python-3.11.9.txt im Hauptordner.
import math, random, os, sys
from PIL import Image, ImageDraw, ImageFilter
OUT = sys.argv[1]
os.makedirs(OUT + "/gallery", exist_ok=True)
os.makedirs(OUT + "/panorama", exist_ok=True)
os.makedirs(OUT + "/places", exist_ok=True)

def ridge(w, base, amp, rough, seed, wrap=False):
    rnd = random.Random(seed)
    n = 1
    while n < w: n *= 2
    pts = [0.0] * (n + 1)
    pts[0] = pts[n] = rnd.uniform(-1, 1)
    if wrap: pts[n] = pts[0]
    step, scale = n, 1.0
    while step > 1:
        half = step // 2
        for i in range(half, n, step):
            pts[i] = (pts[i - half] + pts[i + half]) / 2 + rnd.uniform(-1, 1) * scale
        step, scale = half, scale * rough
    return [base - pts[int(x * n / w)] * amp for x in range(w)]

def lerp(a, b, t): return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))

def landscape(w, h, seed, tint=(0, 0, 0), lake=False, trees=True, wrap=False, night=False):
    rnd = random.Random(seed)
    img = Image.new("RGB", (w, h))
    d = ImageDraw.Draw(img)
    top, bottom = ((28, 30, 34), (92, 96, 102)) if night else ((196, 200, 204), (236, 236, 234))
    horizon = int(h * (0.62 if lake else 0.7))
    for y in range(h):
        d.line([(0, y), (w, y)], fill=lerp(top, bottom, min(1, y / horizon)))
    layers = [
        (0.42, 0.20, (150, 152, 155), (250, 250, 250)),
        (0.50, 0.15, (112, 113, 115), (232, 232, 230)),
        (0.60, 0.10, (78, 78, 78), None),
        (0.70, 0.06, (48, 46, 44), None),
    ]
    if night:
        layers = [(b, a, tuple(int(v * 0.45) for v in c), (150, 154, 160) if s else None) for b, a, c, s in layers]
    for i, (base, amp, col, snow) in enumerate(layers):
        col = tuple(min(255, max(0, col[k] + tint[k])) for k in range(3))
        ys = ridge(w, h * base * (0.9 if lake else 1), h * amp, 0.62, seed * 10 + i, wrap)
        poly = [(x, ys[x]) for x in range(w)] + [(w, h), (0, h)]
        d.polygon(poly, fill=col)
        if snow:
            for x in range(w):
                lim = h * (base - amp * 0.2)
                if ys[x] < lim:
                    depth = min(h * 0.045, (lim - ys[x]) * 0.7)
                    d.line([(x, ys[x]), (x, ys[x] + depth)], fill=snow)
        if trees and i == 3:
            for _ in range(w // 9):
                x = rnd.randrange(w); yb = ys[x] + rnd.uniform(0, h * 0.08)
                th = rnd.uniform(h * 0.02, h * 0.05)
                d.polygon([(x, yb - th), (x - th * 0.28, yb), (x + th * 0.28, yb)], fill=(30, 29, 27) if not night else (14, 14, 14))
    if lake:
        ly = int(h * 0.74)
        d.rectangle([0, ly, w, h], fill=(70, 78, 84) if not night else (20, 24, 28))
        src = img.crop((0, ly - (h - ly), w, ly)).transpose(Image.FLIP_TOP_BOTTOM)
        src = src.filter(ImageFilter.GaussianBlur(3))
        img.paste(Image.blend(src, Image.new("RGB", src.size, (60, 70, 78)), 0.45), (0, ly))
        d = ImageDraw.Draw(img)
        for _ in range(w // 6):
            x = rnd.randrange(w); y = rnd.randrange(ly + 4, h)
            d.line([(x, y), (x + rnd.randint(8, 40), y)], fill=(150, 156, 160) if not night else (60, 66, 72))
    if night:
        for _ in range(w // 3):
            x, y = rnd.randrange(w), rnd.randrange(int(h * 0.35))
            d.point((x, y), fill=(220, 222, 226))
    grain = Image.effect_noise((w, h), 10).convert("RGB")
    return Image.blend(img, grain, 0.04)

def save(img, path, widths):
    for wd in widths:
        im = img if img.width == wd else img.resize((wd, int(img.height * wd / img.width)), Image.LANCZOS)
        im.save(f"{path}-{wd}.webp", "WEBP", quality=78, method=6)

save(landscape(2400, 1400, 1, lake=True), OUT + "/hero", [960, 1600, 2400])
specs = [(2, False, (0, 0, 0), False), (3, True, (-4, 0, 6), False), (4, False, (8, 4, 0), False),
         (5, False, (0, 0, 0), True), (6, True, (0, 2, 4), False), (7, False, (6, 3, 0), False),
         (8, False, (0, 0, 0), False), (9, True, (0, 0, 0), True), (10, False, (-3, 0, 4), False)]
for n, (seed, lake, tint, night) in enumerate(specs, 1):
    w, h = (1800, 1200) if n % 3 else (1200, 1500)
    save(landscape(w, h, seed * 7, tint, lake, night=night), f"{OUT}/gallery/bild-{n:02d}", [600, w])
for n, seed in enumerate([11, 12, 13, 14], 1):
    save(landscape(1200, 900, seed * 5, lake=(n % 2 == 0)), f"{OUT}/places/ort-{n}", [600, 1200])
# Äquirektangulare Panoramen (2:1), nahtlos umlaufend
for n, (seed, lake) in enumerate([(21, True), (22, False)], 1):
    p = landscape(4096, 2048, seed, lake=lake, wrap=True)
    p.save(f"{OUT}/panorama/panorama-{n}.jpg", "JPEG", quality=82, progressive=True, optimize=True)
p.resize((800, 400)).save(f"{OUT}/panorama/panorama-1-preview.webp", "WEBP", quality=70)
Image.open(f"{OUT}/panorama/panorama-2.jpg").resize((800, 400)).save(f"{OUT}/panorama/panorama-2-preview.webp", "WEBP", quality=70)
landscape(1200, 630, 1, lake=True).save(OUT + "/og-image.jpg", "JPEG", quality=80)
print("ok")

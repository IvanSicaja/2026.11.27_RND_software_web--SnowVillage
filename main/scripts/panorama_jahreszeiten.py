"""
Erzeugt vier 360°-Panoramen (äquirektangular, 2:1): Winter, Frühling, Sommer, Herbst.
Derselbe Ort in jeder Jahreszeit: Blick von einem Hügel über Bergsee, Dorf mit Holzhäusern
und Kirche, Wald und Gipfel. Stil: ruhige, moderne Low-Poly-Illustration mit echter Perspektive.
Es sind gerenderte Illustrationen (keine Fotos) – Platzhalter, bis eigene 360°-Fotos da sind.

Aufruf (im Ordner main/):
    python scripts/panorama_jahreszeiten.py public/images/panorama          (4096 × 2048)
    python scripts/panorama_jahreszeiten.py public/images/panorama 1536     (schnelle Vorschau)
Abhängigkeiten: numpy, Pillow (siehe draft_requirements_python-3.11.9.txt)
"""
import math
import os
import sys

import numpy as np
from PIL import Image, ImageFilter

OUT = sys.argv[1] if len(sys.argv) > 1 else "public/images/panorama"
W = int(sys.argv[2]) if len(sys.argv) > 2 else 4096
H = W // 2
TAU = 2 * math.pi
DEG = math.pi / 180
CAM_H = 14.0  # Kamerahöhe in Metern (Aussichtspunkt über dem Dorf)

SEASONS = {
    "winter": dict(
        sky_top=(74, 118, 178), sky_hor=(214, 226, 238), sun_az=205, sun_el=12, sun=(255, 236, 214), clouds=0.22,
        rock=(112, 120, 136), snow=(248, 250, 254), snow_sh=(160, 180, 210), snow_el=[3, 2, 0.0, 0.0],
        hill=[(226, 232, 242), (208, 218, 232)], forest=[(36, 52, 50)], tree_snow=True,
        ground=(244, 247, 252), ground_far=(214, 224, 238), ground_tex=0.04, path=(222, 214, 204),
        lake=(168, 188, 206), frozen=True, roof=(240, 244, 250), haze=(206, 218, 234), flowers=None, leaf=None,
    ),
    "fruehling": dict(
        sky_top=(62, 124, 200), sky_hor=(204, 224, 242), sun_az=160, sun_el=36, sun=(255, 250, 232), clouds=0.42,
        rock=(118, 118, 120), snow=(250, 252, 254), snow_sh=(196, 208, 226), snow_el=[16, 12.5, 99, 99],
        hill=[(92, 140, 70), (76, 122, 58)], forest=[(42, 82, 50), (66, 112, 58)], tree_snow=False,
        ground=(128, 178, 78), ground_far=(104, 150, 76), ground_tex=0.1, path=(196, 180, 150),
        lake=(52, 110, 128), frozen=False, roof=(70, 62, 58), haze=(196, 214, 234),
        flowers=[(252, 232, 80), (255, 255, 255), (196, 150, 226), (250, 180, 200)], leaf=[(150, 200, 110), (240, 210, 230)],
    ),
    "sommer": dict(
        sky_top=(36, 100, 196), sky_hor=(184, 212, 240), sun_az=178, sun_el=58, sun=(255, 252, 242), clouds=0.28,
        rock=(124, 118, 112), snow=(246, 248, 252), snow_sh=(192, 202, 220), snow_el=[20.5, 99, 99, 99],
        hill=[(72, 126, 58), (58, 108, 48)], forest=[(30, 66, 40), (44, 86, 46)], tree_snow=False,
        ground=(104, 164, 60), ground_far=(86, 140, 62), ground_tex=0.1, path=(204, 186, 150),
        lake=(28, 108, 132), frozen=False, roof=(66, 58, 54), haze=(180, 206, 236),
        flowers=[(255, 255, 255), (252, 214, 70)], leaf=[(70, 130, 60), (90, 150, 66)],
    ),
    "herbst": dict(
        sky_top=(70, 112, 172), sky_hor=(236, 218, 196), sun_az=220, sun_el=17, sun=(255, 206, 150), clouds=0.48,
        rock=(122, 110, 104), snow=(248, 248, 250), snow_sh=(206, 200, 210), snow_el=[18, 99, 99, 99],
        hill=[(170, 128, 62), (144, 104, 52)], forest=[(40, 62, 42), (204, 136, 42), (222, 176, 56), (160, 74, 36)], tree_snow=False,
        ground=(164, 152, 76), ground_far=(150, 128, 76), ground_tex=0.12, path=(176, 150, 112),
        lake=(46, 86, 100), frozen=False, roof=(78, 64, 56), haze=(226, 208, 190),
        flowers=None, leaf=[(214, 140, 44), (226, 182, 60), (170, 80, 36)],
    ),
}

xs = np.arange(W)
theta = (xs + 0.5) / W * TAU
phi = (0.5 - (np.arange(H) + 0.5) / H) * math.pi
TH, PH = np.meshgrid(theta, phi)


def ycoord(el_rad):
    return int(round((0.5 - el_rad / math.pi) * H))


def xcoord(az_rad):
    return int(round(az_rad / TAU * W))


def lerp(a, b, t):
    t = np.asarray(t, np.float32)
    if t.ndim:
        t = t[..., None]
    return np.asarray(a, np.float32) * (1 - t) + np.asarray(b, np.float32) * t


def periodic_noise(seed, n=160, kmax=40, beta=1.1, sy=1.0):
    r = np.random.default_rng(seed)
    out = np.zeros((H, W), np.float32)
    for _ in range(n):
        kx = int(r.integers(1, kmax))
        ky = r.uniform(-kmax, kmax) * sy
        a = (math.hypot(kx, ky) + 1) ** -beta
        out += (a * np.sin(kx * TH + ky * PH + r.uniform(0, TAU))).astype(np.float32)
    out -= out.min()
    return out / out.max()


# ---------- Geometrie, die in allen Jahreszeiten gleich ist ----------
rng = np.random.default_rng(7)


def ridge_vertices(seed, step, hmin, hmax, peaky):
    r = np.random.default_rng(seed)
    az, pts = 0.0, []
    while az < 360 - step[0]:
        pts.append((az, hmin + (hmax - hmin) * r.random() ** peaky))
        az += r.uniform(*step)
    pts.append((360.0, pts[0][1]))  # nahtlos
    return pts


LAYERS = [
    ridge_vertices(11, (3.5, 8), 9, 27, 1.6),
    ridge_vertices(12, (3, 7), 6, 15, 1.3),
    ridge_vertices(13, (2.5, 6), 2.5, 7.5, 1.0),
    ridge_vertices(14, (2, 5), 0.8, 3.5, 1.0),
]
HAZE = [0.42, 0.26, 0.12, 0.05]


def ridge_profile(pts):
    a = np.array([p[0] for p in pts]) * DEG
    h = np.array([p[1] for p in pts]) * DEG
    prof = np.interp(theta, a, h)
    seg = np.clip(np.searchsorted(a, theta) - 1, 0, len(a) - 2)
    slope = (h[seg + 1] - h[seg]) / (a[seg + 1] - a[seg])
    return prof, slope, seg


PROFILES = [ridge_profile(p) for p in LAYERS]
CLOUD = periodic_noise(21, n=240, kmax=22)
CLOUD2 = periodic_noise(22, n=200, kmax=70, beta=0.9)

# Boden: Ebene in CAM_H Metern unter der Kamera → Bodenkoordinaten je Pixel
with np.errstate(divide="ignore"):
    R = np.where(PH < 0, CAM_H / np.tan(np.clip(-PH, 1e-4, None)), np.inf)
GX, GY = R * np.cos(TH), R * np.sin(TH)
GXc, GYc = np.nan_to_num(GX, posinf=0, neginf=0), np.nan_to_num(GY, posinf=0, neginf=0)
GN = (np.sin(GXc * 0.05 + np.sin(GYc * 0.031) * 3) + np.sin(GYc * 0.043 + GXc * 0.017) + np.sin(GXc * 0.21 + GYc * 0.17) * 0.4)
GN = (GN - GN.min()) / (GN.max() - GN.min())

LAKE_C, LAKE_RX, LAKE_RY = (-150.0, 0.0), 110.0, 70.0  # Bergsee vor der Kamera (Azimut 180°)
LAKE_D = ((GXc - LAKE_C[0]) / LAKE_RX) ** 2 + ((GYc - LAKE_C[1]) / LAKE_RY) ** 2 + 0.08 * np.sin(np.arctan2(GYc, GXc - LAKE_C[0]) * 5)
LAKE = (PH < 0) & (LAKE_D < 1)


def polar(gx, gy):
    return math.atan2(gy, gx) % TAU, math.hypot(gx, gy)


# Häuser: (x, y, Breite, Wandhöhe, Dachhöhe) in Metern – am Seeufer und auf der Wiese
HOUSES = []
hr = np.random.default_rng(3)
for cx, cy, n, spread in [(-110, -125, 10, 40), (-105, 125, 10, 40), (-275, -70, 7, 45), (-270, 80, 7, 45), (-30, -170, 5, 40), (-40, 175, 4, 40)]:
    for _ in range(n):
        x, y = cx + hr.normal(0, spread * 0.5), cy + hr.normal(0, spread * 0.5)
        if ((x - LAKE_C[0]) / (LAKE_RX + 18)) ** 2 + ((y - LAKE_C[1]) / (LAKE_RY + 18)) ** 2 < 1:
            continue
        HOUSES.append((x, y, hr.uniform(11, 17), hr.uniform(6, 8.5), hr.uniform(4.5, 7)))
CHURCH = (-125.0, -100.0)

TREES = []
tr = np.random.default_rng(5)
for _ in range(750):
    a, d = tr.uniform(0, TAU), 55 + tr.random() ** 1.3 * 700
    if abs(a - math.pi) < 0.75 and d < 330:  # freie Sicht auf See und Dorf
        continue
    x, y = d * math.cos(a), d * math.sin(a)
    if ((x - LAKE_C[0]) / (LAKE_RX + 10)) ** 2 + ((y - LAKE_C[1]) / (LAKE_RY + 10)) ** 2 < 1:
        continue
    if any((x - hx) ** 2 + (y - hy) ** 2 < 26 ** 2 for hx, hy, *_ in HOUSES):
        continue
    if (x - CHURCH[0]) ** 2 + (y - CHURCH[1]) ** 2 < 30 ** 2:
        continue
    TREES.append((x, y, tr.uniform(9, 20), tr.random(), tr.random()))


def render(name, s):
    img = np.zeros((H, W, 3), np.float32)
    sun_az, sun_el = s["sun_az"] * DEG, s["sun_el"] * DEG
    side = np.sin(sun_az - theta)  # >0: Sonne rechts

    # ---------- Himmel ----------
    t = np.clip(PH / (math.pi / 2), 0, 1) ** 0.5
    img[:] = lerp(s["sky_hor"], s["sky_top"], t)
    cosang = np.sin(PH) * math.sin(sun_el) + np.cos(PH) * math.cos(sun_el) * np.cos(TH - sun_az)
    ang = np.arccos(np.clip(cosang, -1, 1))
    glow = np.clip(np.exp(-ang / 0.3) * 0.5 + np.exp(-ang / 0.05) * 0.5, 0, 1)
    img = lerp(img, s["sun"], glow)
    img[ang < 0.013] = s["sun"]
    c = np.clip((CLOUD * 0.7 + CLOUD2 * 0.3 - (1 - s["clouds"]) * 0.92) * 3.5, 0, 1)
    c *= np.clip(PH / (5 * DEG), 0, 1) * np.clip(1.2 - PH / (70 * DEG), 0.1, 1)
    ccol = lerp((172, 180, 196), (255, 255, 255), np.clip(CLOUD2 * 1.3 + glow * 0.8, 0, 1))
    img = lerp(img, ccol, c * 0.9)

    # ---------- Berge (fern → nah), Low-Poly-Facetten ----------
    for i, (prof, slope, seg) in enumerate(PROFILES):
        top = prof[None, :]
        mask = (PH < top) & (PH > -0.5 * DEG)
        facet = np.clip(0.8 + 0.45 * np.tanh(slope * 3) * np.sign(side + 1e-6), 0.45, 1.2)
        facet = facet * (0.97 + 0.06 * (seg % 2))  # leichte Facettenkanten
        vert = np.clip((top - PH) / (top + 2 * DEG), 0, 1)  # 0 = Grat, 1 = Fuss
        if i < 2:
            base = lerp(s["rock"], np.asarray(s["rock"]) * 0.75, vert)
            col = base * facet[None, :, None]
            el = s["snow_el"][i] * DEG
            snowy = (PH > el + 0.6 * DEG * np.sin(theta * 37 + i)[None, :]) & mask
            scol = lerp(s["snow_sh"], s["snow"], np.clip((facet - 0.55) * 1.6, 0, 1))
            col = np.where(snowy[..., None], np.broadcast_to(scol[None, :, :], (H, W, 3)), col)
        else:
            hill = s["hill"][i - 2]
            col = np.asarray(hill, np.float32) * (facet[None, :, None] * 0.25 + 0.8) * (1 - 0.18 * vert)[..., None]
        col = lerp(col, s["haze"], HAZE[i] * (1 - 0.35 * vert))
        img[mask] = col[mask]
        # Waldsaum aus kleinen Tannen entlang der nahen Hügel
        if i >= 2:
            fr = np.random.default_rng(30 + i)
            size = 0.9 if i == 2 else 1.4
            for _ in range(int(W * (0.35 if i == 2 else 0.25))):
                az = fr.uniform(0, TAU)
                xi = xcoord(az) % W
                ridge_el = prof[xi] - fr.uniform(0, 0.6 if i == 2 else 1.2) * DEG
                h_el = size * fr.uniform(0.6, 1.2) * DEG
                draw_tree(img, az, ridge_el, h_el, h_el * 0.38, s, fr.random(), haze=HAZE[i] + 0.05)

    # ---------- Boden ----------
    below = PH < -0.5 * DEG
    far = np.clip(R / 900, 0, 1)
    g = lerp(s["ground"], s["ground_far"], far ** 0.6)
    g = g * (1 - s["ground_tex"] + 2 * s["ground_tex"] * GN)[..., None]
    if s["frozen"]:  # Schneeschatten
        g = lerp(g, s["snow_sh"], np.clip((GN - 0.62) * 1.4, 0, 0.5))
    # Weg vom Aussichtspunkt hinunter ins Dorf
    path = np.abs(GYc - 18 * np.sin(GXc / 40)) < 1.6 + R * 0.004
    path &= (GXc < 0) & (R < 300) & ~LAKE
    g[path] = lerp(g[path], s["path"], 0.85)
    if s["flowers"]:
        fl = np.random.default_rng(9)
        spot = (fl.random((H, W)) < 0.006) & (R < 90) & ~LAKE & ~path
        cols = np.asarray(s["flowers"], np.float32)[fl.integers(0, len(s["flowers"]), (H, W))]
        g[spot] = cols[spot]
    g = lerp(g, s["haze"], np.clip(far * 0.5, 0, 0.5))
    img[below] = g[below]

    # ---------- Bergsee mit Spiegelung ----------
    yy, xx = np.nonzero(LAKE)
    rip = 0 if s["frozen"] else (np.sin(GXc[yy, xx] * 0.9) * 2 + np.sin(GYc[yy, xx] * 0.6) * 1.5).astype(int)
    my = np.clip(2 * (H // 2) - yy, 0, H - 1)
    refl = img[my, (xx + rip) % W]
    fres = np.clip(1 - (-PH[yy, xx]) / (25 * DEG), 0.35, 0.85)[:, None]  # flach = mehr Spiegelung
    water = refl * fres + np.asarray(s["lake"], np.float32) * (1 - fres)
    if s["frozen"]:
        water = lerp(water, (236, 242, 250), np.clip(GN[yy, xx] * 0.6, 0, 0.6))
    img[yy, xx] = water
    shore = (PH < 0) & (LAKE_D >= 1) & (LAKE_D < 1.06)
    img[shore] = img[shore] * 0.78

    # ---------- Objekte nach Entfernung sortiert (fern zuerst) ----------
    objs = [("house", h, polar(h[0], h[1])[1]) for h in HOUSES]
    objs += [("tree", t_, polar(t_[0], t_[1])[1]) for t_ in TREES]
    objs.append(("church", CHURCH, polar(*CHURCH)[1]))
    for kind, o, dist in sorted(objs, key=lambda q: -q[2]):
        fog = min(0.55, dist / 1600)
        if kind == "tree":
            az, d = polar(o[0], o[1])
            base = -math.atan(CAM_H / d)
            top = math.atan((o[2] - CAM_H) / d)
            draw_tree(img, az, top, top - base, math.atan(o[2] * 0.2 / d), s, o[3], haze=fog)
        elif kind == "house":
            draw_house(img, o, s, fog, sun_az)
        else:
            draw_church(img, o, s, fog, sun_az)

    # ---------- Feinschliff ----------
    img *= (1 - 0.2 * np.clip(-PH / (90 * DEG), 0, 1) ** 1.6)[..., None]
    img += np.random.default_rng(1).normal(0, 1.8, (H, W, 1)).astype(np.float32)
    out = Image.fromarray(np.clip(img, 0, 255).astype(np.uint8))
    out = out.filter(ImageFilter.SMOOTH)
    os.makedirs(OUT, exist_ok=True)
    out.save(f"{OUT}/jahreszeit-{name}.jpg", "JPEG", quality=85, progressive=True, optimize=True)
    prev = out.crop((W // 4, int(H * 0.27), W * 3 // 4, int(H * 0.77))).resize((1200, 600), Image.LANCZOS)
    prev.save(f"{OUT}/jahreszeit-{name}-vorschau.webp", "WEBP", quality=76)
    print("✓", name)


def put(img, x0, x1, y0, y1, color, fog=0.0, haze=(255, 255, 255)):
    y0, y1 = max(0, y0), min(H, y1)
    if y1 <= y0 or x1 <= x0:
        return
    col = np.asarray(color, np.float32) * (1 - fog) + np.asarray(haze, np.float32) * fog
    if x0 < 0 or x1 > W:
        for x in range(x0, x1):
            img[y0:y1, x % W] = col
    else:
        img[y0:y1, x0:x1] = col


def triangle(img, az, base_el, top_el, half_w, color, fog, haze):
    """Gleichschenkliges Dreieck (Spitze oben) in Bildkoordinaten."""
    xc = az / TAU * W
    hw = max(1.0, half_w / TAU * W)
    yb, yt = ycoord(base_el), ycoord(top_el)
    if yb - yt < 1:
        return
    for y in range(max(0, yt), min(H, yb + 1)):
        f = (y - yt) / max(1, yb - yt)
        w = hw * f
        put(img, int(round(xc - w)), int(round(xc + w)) + 1, y, y + 1, color, fog, haze)


def draw_tree(img, az, top_el, height_el, half_w, s, r, haze=0.0):
    base_el = top_el - height_el
    if s["leaf"] and r < 0.4:  # Laubbaum (rund)
        col = s["leaf"][int(r * 10) % len(s["leaf"])]
        put(img, xcoord(az) - 0, xcoord(az) + max(1, int(half_w / TAU * W * 0.25)), ycoord(base_el + height_el * 0.3), ycoord(base_el), (70, 52, 40), haze, s["haze"])
        xc, hw = az / TAU * W, max(1.5, half_w / TAU * W * 1.1)
        yc, rh = ycoord(base_el + height_el * 0.62), max(1.5, height_el / math.pi * H * 0.4)
        for y in range(int(yc - rh), int(yc + rh) + 1):
            f = 1 - ((y - yc) / rh) ** 2
            if f <= 0:
                continue
            w = hw * math.sqrt(f)
            put(img, int(xc - w), int(xc + w) + 1, y, y + 1, col, haze, s["haze"])
        return
    fc = s["forest"][int(r * 97) % len(s["forest"])] if len(s["forest"]) > 1 and r > 0.55 else s["forest"][0]
    triangle(img, az, base_el, top_el, half_w, fc, haze, s["haze"])
    if s["tree_snow"]:  # Schneehauben
        for k in (0.0, 0.35, 0.65):
            t_el = top_el - height_el * k
            triangle(img, az, t_el - height_el * 0.12, t_el, half_w * (k + 0.12) * 0.9, s["snow"], haze, s["haze"])


def draw_house(img, h, s, fog, sun_az):
    x, y, w, wall, roof_h = h
    az, d = polar(x, y)
    half = math.atan(w / 2 / d)
    base = -math.atan(CAM_H / d)
    eave = math.atan((wall - CAM_H) / d)
    peak = math.atan((wall + roof_h - CAM_H) / d)
    lit = 1.08 if math.sin(sun_az - az) > 0 else 0.86
    wood = np.asarray((112, 72, 44), np.float32) * lit
    x0, x1 = xcoord(az - half), xcoord(az + half) + 1
    put(img, x0, x1, ycoord(eave), ycoord(base), wood, fog, s["haze"])
    # Holzbalken / Fenster mit warmem Licht
    wy0, wy1 = ycoord(eave - (eave - base) * 0.3), ycoord(eave - (eave - base) * 0.6)
    ww = max(1, (x1 - x0) // 6)
    for k in (1, 4):
        put(img, x0 + k * ww, x0 + k * ww + ww, wy0, max(wy0 + 1, wy1), (255, 198, 112), fog * 0.6, s["haze"])
    triangle(img, az, eave, peak, half * 1.22, s["roof"], fog, s["haze"])


def draw_church(img, c, s, fog, sun_az):
    az, d = polar(*c)
    base = -math.atan(CAM_H / d)
    wall = (236, 232, 222)
    # Kirchenschiff
    nh = math.atan(22 / 2 / d)
    naz = az + 1.6 * nh
    put(img, xcoord(naz - nh), xcoord(naz + nh) + 1, ycoord(math.atan((9 - CAM_H) / d)), ycoord(base), wall, fog, s["haze"])
    triangle(img, naz, math.atan((9 - CAM_H) / d), math.atan((15 - CAM_H) / d), nh * 1.15, s["roof"], fog, s["haze"])
    # Turm mit spitzem Helm
    th = math.atan(4.5 / d)
    tower_top = math.atan((26 - CAM_H) / d)
    put(img, xcoord(az - th), xcoord(az + th) + 1, ycoord(tower_top), ycoord(base), wall, fog, s["haze"])
    put(img, xcoord(az - th * 0.4), xcoord(az + th * 0.4) + 1, ycoord(tower_top - math.atan(5 / d)), ycoord(tower_top - math.atan(2.5 / d)), (60, 52, 46), fog, s["haze"])
    triangle(img, az, tower_top, math.atan((40 - CAM_H) / d), th * 1.15, (70, 76, 72) if not s["frozen"] else (226, 232, 240), fog, s["haze"])


if __name__ == "__main__":
    for name, season in SEASONS.items():
        render(name, season)

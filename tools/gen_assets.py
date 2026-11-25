#!/usr/bin/env python3
# ============================================================
#  tools/gen_assets.py — deterministic art generator
#  Produces every NEW sprite / background shipped with v6.
#  The look matches the hand-made sheet: near-black bodies,
#  violet rim light, bone highlights, red glowing eyes and a
#  heavy film-grain pass.
#  Run:  python3 tools/gen_assets.py
# ============================================================
import math
import os
import random

from PIL import Image, ImageDraw, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
AST = os.path.join(ROOT, 'assets')
os.makedirs(AST, exist_ok=True)

# ---------- palette ----------
INK       = (7, 4, 15, 255)
BODY      = (19, 13, 32, 255)
BODY_D    = (11, 7, 20, 255)
CLOTH     = (30, 21, 44, 255)
CLOTH_D   = (18, 12, 30, 255)
RIM       = (74, 52, 92, 255)
RIM_HI    = (126, 96, 138, 255)
BONE      = (196, 186, 172, 255)
BONE_D    = (128, 118, 106, 255)
SKIN      = (62, 46, 64, 255)
BLOOD     = (110, 14, 30, 255)
BLOOD_HI  = (168, 27, 46, 255)
EYE       = (255, 66, 84, 255)
EYE_SOFT  = (226, 54, 80, 190)
GLOW_CY   = (120, 200, 255, 255)
GLOW_AM   = (255, 196, 110, 255)


def surface(w, h):
    return Image.new('RGBA', (w, h), (0, 0, 0, 0))


def d(img):
    return ImageDraw.Draw(img, 'RGBA')


def poly(img, pts, fill):
    d(img).polygon([(round(x), round(y)) for x, y in pts], fill=fill)


def ell(img, x, y, rx, ry, fill):
    d(img).ellipse([x - rx, y - ry, x + rx, y + ry], fill=fill)


def rect(img, x, y, w, h, fill):
    d(img).rectangle([x, y, x + w - 1, y + h - 1], fill=fill)


def limb(img, x1, y1, x2, y2, w1, w2, fill):
    """tapered limb as a quad"""
    dx, dy = x2 - x1, y2 - y1
    L = math.hypot(dx, dy) or 1
    nx, ny = -dy / L, dx / L
    pts = [
        (x1 + nx * w1, y1 + ny * w1),
        (x1 - nx * w1, y1 - ny * w1),
        (x2 - nx * w2, y2 - ny * w2),
        (x2 + nx * w2, y2 + ny * w2),
    ]
    poly(img, pts, fill)


def glow(img, x, y, r, color, strength=1.0):
    """soft radial light, composited with 'screen' so it never greys out"""
    w = max(3, int(r * 2))
    g = Image.new('RGBA', (w, w), (0, 0, 0, 0))
    gd = ImageDraw.Draw(g)
    steps = 12
    for i in range(steps, 0, -1):
        t = i / steps
        a = int(color[3] * strength * (1 - t) ** 2.2) if len(color) > 3 else int(255 * strength * (1 - t) ** 2.2)
        gd.ellipse([w / 2 - r * t, w / 2 - r * t, w / 2 + r * t, w / 2 + r * t],
                   fill=(color[0], color[1], color[2], a))
    g = g.filter(ImageFilter.GaussianBlur(r * 0.16))
    base = Image.new('RGBA', img.size, (0, 0, 0, 0))
    base.paste(g, (int(x - w / 2), int(y - w / 2)), g)
    out = Image.alpha_composite(img, base)
    img.paste(out, (0, 0))


def rim_light(img, color, dy=1, dx=1, only_top=True, strength=0.55):
    """thin light edge on the upper-left silhouette (pure PIL, no numpy)"""
    mask = img.split()[3].point(lambda a: 255 if a > 40 else 0)
    shifted = mask.transform(mask.size, Image.AFFINE, (1, 0, dx, 0, 1, dy))
    px = img.load()
    m = mask.load()
    s = shifted.load()
    W, H = img.size
    f = strength
    for y in range(H):
        if only_top and y > H * 0.76:
            continue
        for x in range(W):
            if m[x, y] and not s[x, y]:
                r, g, b, a = px[x, y]
                px[x, y] = (int(r * (1 - f) + color[0] * f),
                            int(g * (1 - f) + color[1] * f),
                            int(b * (1 - f) + color[2] * f), a)
    return img


def grain(img, amount=0.24, seed=1):
    """film grain + vertical falloff, keeps the sheet's texture"""
    rnd = random.Random(seed)
    px = img.load()
    W, H = img.size
    for y in range(H):
        fall = 0.72 + 0.28 * (1 - y / max(1, H - 1))
        for x in range(W):
            r, g, b, a = px[x, y]
            if a == 0:
                continue
            n = 1.0 - rnd.random() * amount
            px[x, y] = (int(r * n * fall), int(g * n * fall), int(b * n * fall), a)
    return img


def eye(img, x, y, rx=2.4, ry=1.7, color=EYE, halo=9):
    glow(img, x, y, halo, EYE_SOFT, 0.9)
    ell(img, x, y, rx, ry, color)
    ell(img, x, y, rx * 0.44, ry * 0.62, (255, 214, 220, 255))


def save(img, name):
    path = os.path.join(AST, name + '.png')
    img.save(path, optimize=True)
    print('  wrote', name + '.png', img.size)


# ============================================================
#  MONSTERS
# ============================================================
def mon_warden():
    """tall night-warden with a coat, a ring of keys and a lamp head"""
    W, H = 62, 106
    im = surface(W, H)
    cx = W / 2
    # coat
    poly(im, [(cx - 15, 40), (cx + 15, 40), (cx + 22, H - 4), (cx - 22, H - 4)], CLOTH)
    poly(im, [(cx - 3, 40), (cx + 3, 40), (cx + 5, H - 6), (cx - 5, H - 6)], CLOTH_D)
    # shoulders / chest
    poly(im, [(cx - 17, 34), (cx + 17, 34), (cx + 15, 52), (cx - 15, 52)], BODY)
    # arms
    limb(im, cx - 15, 38, cx - 22, 76, 4.4, 3.2, BODY)
    limb(im, cx + 15, 38, cx + 24, 70, 4.4, 3.0, BODY)
    limb(im, cx - 22, 76, cx - 20, 94, 3.0, 2.2, SKIN)
    limb(im, cx + 24, 70, cx + 21, 90, 2.8, 2.2, SKIN)
    # keys on the belt
    for i, kx in enumerate((-9, -2, 5)):
        limb(im, cx + kx, 56, cx + kx + 1, 66 + i * 2, 1.1, 0.8, BONE_D)
        ell(im, cx + kx + 1, 66 + i * 2, 1.8, 1.4, BONE)
    # head: a hooded lamp
    ell(im, cx, 24, 11, 12, BODY)
    poly(im, [(cx - 12, 22), (cx - 8, 8), (cx + 8, 8), (cx + 12, 22), (cx + 9, 32), (cx - 9, 32)], BODY_D)
    poly(im, [(cx - 8, 22), (cx - 5, 14), (cx + 5, 14), (cx + 8, 22), (cx + 5, 27), (cx - 5, 27)], (60, 42, 34, 255))
    glow(im, cx, 21, 15, GLOW_AM, 1.0)
    eye(im, cx - 4.4, 20, 1.8, 1.3)
    eye(im, cx + 4.4, 20, 1.8, 1.3)
    rim_light(im, RIM_HI)
    grain(im, 0.22, 11)
    save(im, 'mon_warden')


def mon_drowned():
    """bloated drowned thing, long dragging arms"""
    W, H = 78, 84
    im = surface(W, H)
    cx = W / 2
    ell(im, cx, 56, 26, 24, BODY)
    ell(im, cx, 44, 20, 16, SKIN)
    poly(im, [(cx - 26, 60), (cx + 26, 60), (cx + 20, H - 3), (cx - 20, H - 3)], CLOTH_D)
    # ribs showing through the waterlogged skin
    for i in range(4):
        limb(im, cx - 14, 46 + i * 5, cx + 13, 44 + i * 5, 1.0, 1.0, BONE_D)
    # arms reaching the floor
    limb(im, cx - 18, 48, cx - 33, 76, 5.0, 2.6, SKIN)
    limb(im, cx - 33, 76, cx - 30, 84, 2.6, 1.8, BONE_D)
    limb(im, cx + 18, 48, cx + 34, 70, 5.0, 2.6, SKIN)
    limb(im, cx + 34, 70, cx + 31, 82, 2.6, 1.8, BONE_D)
    for fx in (cx - 30, cx + 31):
        for k in range(3):
            limb(im, fx, 80, fx + (k - 1) * 3, 84, 1.0, 0.7, BONE_D)
    # head sunk into the shoulders
    ell(im, cx, 30, 13, 13, SKIN)
    ell(im, cx - 4, 34, 4, 3, (6, 4, 10, 255))
    ell(im, cx + 4, 34, 4, 3, (6, 4, 10, 255))
    eye(im, cx - 5, 28, 2.1, 1.4)
    eye(im, cx + 5, 28, 2.1, 1.4)
    # dripping water
    for i in range(9):
        x = 14 + i * 6
        rect(im, x, 62 + (i * 7) % 18, 1, 5 + (i * 3) % 7, (120, 190, 210, 110))
    rim_light(im, RIM)
    grain(im, 0.26, 22)
    save(im, 'mon_drowned')


def mon_bell():
    """bell-headed acolyte, mouth opens like a clapper slot"""
    W, H = 64, 102
    im = surface(W, H)
    cx = W / 2
    # robe
    poly(im, [(cx - 11, 46), (cx + 11, 46), (cx + 24, H - 3), (cx - 24, H - 3)], CLOTH)
    poly(im, [(cx - 4, 46), (cx + 4, 46), (cx + 7, H - 3), (cx - 7, H - 3)], CLOTH_D)
    limb(im, cx - 11, 52, cx - 21, 78, 3.4, 2.4, BODY)
    limb(im, cx + 11, 52, cx + 21, 78, 3.4, 2.4, BODY)
    # brass bell head
    poly(im, [(cx - 13, 30), (cx - 9, 8), (cx + 9, 8), (cx + 13, 30), (cx + 16, 40), (cx - 16, 40)], (46, 34, 42, 255))
    poly(im, [(cx - 13, 30), (cx - 9, 8), (cx + 9, 8), (cx + 13, 30)], (72, 52, 58, 255))
    # mouth slot
    poly(im, [(cx - 7, 33), (cx + 7, 33), (cx + 5, 38), (cx - 5, 38)], (8, 3, 8, 255))
    ell(im, cx, 34, 3.2, 2.2, EYE)
    glow(im, cx, 34, 12, EYE_SOFT, 0.8)
    rect(im, cx - 1, 40, 2, 8, BONE_D)
    ell(im, cx, 49, 2.6, 2.6, BONE)
    rim_light(im, RIM_HI)
    grain(im, 0.2, 33)
    save(im, 'mon_bell')


def mon_choir():
    """floating robed singer with a broken halo and many mouths"""
    W, H = 66, 96
    im = surface(W, H)
    cx = W / 2
    poly(im, [(cx - 9, 34), (cx + 9, 34), (cx + 22, H - 8), (cx - 22, H - 8)], CLOTH)
    for i in range(5):
        poly(im, [(cx - 20 + i * 8, H - 8), (cx - 16 + i * 8, H - 8), (cx - 17 + i * 8, H - 1), (cx - 21 + i * 8, H - 1)], CLOTH_D)
    # sleeves
    limb(im, cx - 9, 40, cx - 25, 62, 4.5, 2.0, CLOTH_D)
    limb(im, cx + 9, 40, cx + 25, 62, 4.5, 2.0, CLOTH_D)
    # hood + void face
    ell(im, cx, 24, 12, 14, BODY_D)
    ell(im, cx, 26, 8, 10, (5, 2, 8, 255))
    # many small mouths singing
    for i, (mx, my, mr) in enumerate([(cx, 22, 2.8), (cx - 3.4, 28, 1.9), (cx + 3.4, 28, 1.9), (cx, 31, 1.4)]):
        ell(im, mx, my, mr, mr * 1.5, (222, 210, 214, 235))
        ell(im, mx, my, mr * 0.5, mr * 0.8, (60, 8, 16, 255))
    eye(im, cx - 5, 18, 1.5, 1.1)
    eye(im, cx + 5, 18, 1.5, 1.1)
    # broken halo
    for a0 in (-160, -110, -40, 10, 60):
        a1 = a0 + 34
        pts = [(cx + 19 * math.cos(math.radians(a)), 14 + 6 * math.sin(math.radians(a))) for a in range(int(a0), int(a1), 4)]
        for i in range(len(pts) - 1):
            limb(im, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], 1.1, 1.1, (196, 168, 96, 210))
    glow(im, cx, 24, 26, (160, 40, 70, 120), 0.7)
    rim_light(im, RIM)
    grain(im, 0.24, 44)
    save(im, 'mon_choir')


def mon_brute():
    """huge armoured thing — slow, heavy, scary"""
    W, H = 92, 112
    im = surface(W, H)
    cx = W / 2
    ell(im, cx, 60, 33, 34, BODY)
    poly(im, [(cx - 33, 44), (cx + 33, 44), (cx + 29, 88), (cx - 29, 88)], BODY_D)
    # armour plates
    for i in range(3):
        poly(im, [(cx - 26 + i * 2, 48 + i * 13), (cx + 26 - i * 2, 48 + i * 13),
                  (cx + 22 - i * 2, 56 + i * 13), (cx - 22 + i * 2, 56 + i * 13)], (44, 32, 48, 255))
    # massive arms
    limb(im, cx - 30, 48, cx - 42, 78, 9, 7, BODY)
    limb(im, cx - 42, 78, cx - 40, 100, 7, 6, SKIN)
    limb(im, cx + 30, 48, cx + 43, 74, 9, 7, BODY)
    limb(im, cx + 43, 74, cx + 41, 98, 7, 6, SKIN)
    ell(im, cx - 40, 102, 8, 5, BONE_D)
    ell(im, cx + 41, 100, 8, 5, BONE_D)
    # legs
    limb(im, cx - 14, 88, cx - 16, H - 3, 8, 6, BODY_D)
    limb(im, cx + 14, 88, cx + 16, H - 3, 8, 6, BODY_D)
    # tiny head
    ell(im, cx, 30, 13, 12, BONE_D)
    ell(im, cx, 32, 8, 7, (10, 6, 14, 255))
    eye(im, cx - 4, 30, 1.9, 1.4)
    eye(im, cx + 4, 30, 1.9, 1.4)
    # spikes on the shoulders
    for sx in (cx - 24, cx + 24):
        poly(im, [(sx - 5, 46), (sx, 26), (sx + 5, 46)], BONE_D)
    rim_light(im, RIM)
    grain(im, 0.22, 55)
    save(im, 'mon_brute')


def mon_spitter():
    """crouched ranged thing with a swollen acid sac"""
    W, H = 64, 72
    im = surface(W, H)
    cx = W / 2
    ell(im, cx, 54, 24, 17, BODY)
    ell(im, cx + 8, 46, 14, 12, (56, 62, 34, 255))   # acid sac
    glow(im, cx + 8, 46, 18, (168, 226, 96, 120), 0.8)
    limb(im, cx - 16, 52, cx - 26, 62, 5, 3, BODY)
    limb(im, cx - 26, 62, cx - 24, H - 2, 3, 2, SKIN)
    limb(im, cx + 16, 52, cx + 26, 62, 5, 3, BODY)
    limb(im, cx + 26, 62, cx + 24, H - 2, 3, 2, SKIN)
    ell(im, cx - 6, 34, 11, 10, SKIN)
    poly(im, [(cx - 18, 30), (cx - 8, 22), (cx + 4, 24), (cx + 6, 34), (cx - 10, 38)], BODY_D)  # hood
    ell(im, cx - 2, 34, 5, 4, (8, 4, 10, 255))       # mouth
    ell(im, cx - 2, 34, 3, 2.4, (168, 226, 96, 220))
    eye(im, cx - 10, 30, 1.8, 1.3)
    eye(im, cx + 1, 30, 1.6, 1.2)
    rim_light(im, RIM)
    grain(im, 0.24, 66)
    save(im, 'mon_spitter')


def mon_swarm():
    """small fast bat cluster"""
    W, H = 48, 40
    im = surface(W, H)
    ell(im, 24, 22, 8, 9, BODY)
    for sgn in (-1, 1):
        poly(im, [(24, 20), (24 + sgn * 20, 10), (24 + sgn * 17, 20), (24 + sgn * 21, 26), (24, 26)], CLOTH_D)
    poly(im, [(20, 14), (18, 7), (22, 13)], BONE_D)
    poly(im, [(28, 14), (30, 7), (26, 13)], BONE_D)
    eye(im, 20.5, 21, 1.8, 1.3, EYE, 7)
    eye(im, 27.5, 21, 1.8, 1.3, EYE, 7)
    ell(im, 24, 26, 2.2, 1.4, (150, 40, 50, 220))
    rim_light(im, RIM, only_top=False)
    grain(im, 0.2, 77)
    save(im, 'mon_swarm')


def mon_heart():
    """BOSS — a heart hanging inside a rib cage"""
    W, H = 132, 132
    im = surface(W, H)
    cx, cy = W / 2, H / 2 + 6
    # ribs
    for i in range(6):
        y = 40 + i * 13
        rr = 46 - abs(i - 2.5) * 4
        for sgn in (-1, 1):
            pts = [(cx + sgn * (rr * math.cos(math.radians(a))), y + 10 * math.sin(math.radians(a)))
                   for a in range(10, 80, 6)]
            for k in range(len(pts) - 1):
                limb(im, pts[k][0], pts[k][1], pts[k + 1][0], pts[k + 1][1], 2.6, 2.2, BONE_D)
    # heart body
    ell(im, cx - 13, cy - 8, 22, 24, BLOOD)
    ell(im, cx + 13, cy - 8, 22, 24, BLOOD)
    poly(im, [(cx - 34, cy - 4), (cx + 34, cy - 4), (cx, cy + 40)], BLOOD)
    ell(im, cx - 15, cy - 12, 12, 12, BLOOD_HI)
    # veins
    for i in range(7):
        a = math.radians(i * 51)
        limb(im, cx, cy, cx + 28 * math.cos(a), cy + 22 * math.sin(a), 1.6, 0.8, (72, 8, 20, 255))
    # big eye in the middle
    ell(im, cx, cy - 2, 11, 8, (240, 226, 226, 255))
    ell(im, cx, cy - 2, 5.4, 5.4, (120, 12, 26, 255))
    ell(im, cx, cy - 2, 2.4, 2.4, (8, 2, 6, 255))
    glow(im, cx, cy, 54, (220, 30, 60, 120), 0.9)
    # hanging chains
    for sgn in (-1, 1):
        for k in range(7):
            ell(im, cx + sgn * 30, 10 + k * 7, 2.4, 3.2, BONE_D if k % 2 else RIM)
    rim_light(im, RIM_HI)
    grain(im, 0.18, 88)
    save(im, 'mon_heart')


def mon_bellboss():
    """BOSS — a cathedral bell that grew hands"""
    W, H = 136, 150
    im = surface(W, H)
    cx = W / 2
    # robe body
    poly(im, [(cx - 30, 90), (cx + 30, 90), (cx + 58, H - 6), (cx - 58, H - 6)], CLOTH)
    poly(im, [(cx - 12, 90), (cx + 12, 90), (cx + 20, H - 6), (cx - 20, H - 6)], CLOTH_D)
    # giant bell head
    poly(im, [(cx - 34, 76), (cx - 26, 20), (cx + 26, 20), (cx + 34, 76), (cx + 44, 92), (cx - 44, 92)], (44, 32, 40, 255))
    poly(im, [(cx - 34, 76), (cx - 26, 20), (cx + 26, 20), (cx + 34, 76)], (76, 56, 62, 255))
    ell(im, cx, 18, 9, 9, BONE_D)
    # mouth slit
    poly(im, [(cx - 22, 66), (cx + 22, 66), (cx + 16, 80), (cx - 16, 80)], (6, 2, 6, 255))
    for i in range(7):
        poly(im, [(cx - 16 + i * 5, 68), (cx - 13 + i * 5, 68), (cx - 14 + i * 5, 78), (cx - 17 + i * 5, 78)], (214, 206, 202, 200))
    eye(im, cx - 12, 44, 3.2, 2.2, EYE, 14)
    eye(im, cx + 12, 44, 3.2, 2.2, EYE, 14)
    glow(im, cx, 74, 40, (220, 30, 60, 130), 0.9)
    # long arms with too many fingers
    limb(im, cx - 30, 96, cx - 56, 120, 7, 4.5, BODY)
    limb(im, cx - 56, 120, cx - 50, 146, 4.5, 3, SKIN)
    limb(im, cx + 30, 96, cx + 58, 116, 7, 4.5, BODY)
    limb(im, cx + 58, 116, cx + 52, 144, 4.5, 3, SKIN)
    for i in range(5):
        limb(im, cx - 50, 146, cx - 54 + i * 2.4, 150, 1.1, 0.6, BONE_D)
        limb(im, cx + 52, 144, cx + 48 + i * 2.4, 150, 1.1, 0.6, BONE_D)
    rim_light(im, RIM_HI)
    grain(im, 0.18, 99)
    save(im, 'mon_bellboss')


def mon_shade():
    """fast levitating wraith — endless mode staple"""
    W, H = 54, 92
    im = surface(W, H)
    cx = W / 2
    poly(im, [(cx - 8, 26), (cx + 8, 26), (cx + 20, H - 12), (cx + 6, H - 4),
              (cx - 4, H - 12), (cx - 20, H - 14)], (16, 10, 28, 255))
    for i in range(4):
        poly(im, [(cx - 18 + i * 9, H - 16), (cx - 12 + i * 9, H - 16),
                  (cx - 14 + i * 9, H - 4 - (i % 2) * 4), (cx - 19 + i * 9, H - 6)], (10, 6, 18, 255))
    ell(im, cx, 20, 10, 12, BODY_D)
    ell(im, cx, 22, 7, 8, (4, 2, 7, 255))
    eye(im, cx - 4, 20, 1.7, 1.2, (120, 200, 255, 255), 10)
    eye(im, cx + 4, 20, 1.7, 1.2, (120, 200, 255, 255), 10)
    limb(im, cx - 8, 34, cx - 22, 50, 3.2, 1.4, (16, 10, 28, 255))
    limb(im, cx + 8, 34, cx + 22, 50, 3.2, 1.4, (16, 10, 28, 255))
    glow(im, cx, 22, 24, (60, 120, 220, 90), 0.7)
    rim_light(im, (90, 130, 190, 255))
    grain(im, 0.26, 111)
    save(im, 'mon_shade')


# ============================================================
#  WEAPONS + ITEM ICONS
# ============================================================
def weapon_base(W, H):
    im = surface(W, H)
    return im


def icon_smg():
    W, H = 40, 26
    im = surface(W, H)
    # receiver
    rect(im, 6, 10, 26, 6, (54, 40, 52, 255))
    rect(im, 6, 10, 26, 2, (92, 70, 82, 255))
    # barrel
    rect(im, 30, 11, 8, 3, (30, 24, 32, 255))
    rect(im, 30, 11, 8, 1, (120, 96, 104, 255))
    # magazine (curved)
    poly(im, [(16, 16), (24, 16), (25, 25), (18, 25)], (40, 30, 40, 255))
    # grip
    poly(im, [(7, 16), (12, 16), (10, 24), (5, 23)], (32, 24, 32, 255))
    # stock
    poly(im, [(0, 9), (7, 11), (7, 15), (0, 16)], (36, 28, 38, 255))
    # sight
    rect(im, 14, 6, 8, 4, (60, 46, 56, 255))
    rect(im, 17, 5, 2, 2, (150, 44, 58, 255))
    rim_light(im, (150, 120, 130, 255), only_top=False, strength=0.4)
    grain(im, 0.18, 201)
    save(im, 'i_smg')


def icon_rifle():
    W, H = 48, 22
    im = surface(W, H)
    rect(im, 4, 9, 34, 5, (48, 36, 46, 255))
    rect(im, 4, 9, 34, 2, (96, 76, 84, 255))
    rect(im, 37, 10, 11, 2, (26, 20, 28, 255))
    # scope
    rect(im, 14, 3, 16, 5, (30, 24, 34, 255))
    rect(im, 14, 3, 16, 1, (140, 118, 126, 255))
    ell(im, 30, 5, 2, 2, (120, 200, 255, 255))
    # stock + grip
    poly(im, [(0, 6), (5, 9), (5, 14), (0, 17)], (38, 28, 34, 255))
    poly(im, [(10, 14), (15, 14), (13, 21), (8, 21)], (32, 24, 30, 255))
    # magazine
    poly(im, [(19, 14), (25, 14), (24, 20), (18, 20)], (44, 32, 40, 255))
    rim_light(im, (160, 140, 150, 255), only_top=False, strength=0.35)
    grain(im, 0.18, 202)
    save(im, 'i_rifle')


def icon_void():
    W, H = 40, 34
    im = surface(W, H)
    # angular energy frame
    poly(im, [(4, 14), (12, 6), (28, 6), (36, 14), (30, 22), (10, 22)], (34, 24, 46, 255))
    poly(im, [(8, 14), (14, 9), (26, 9), (32, 14), (27, 19), (13, 19)], (16, 10, 26, 255))
    glow(im, 20, 15, 16, (150, 110, 255, 160), 0.95)
    ell(im, 20, 15, 5, 5, (198, 172, 255, 255))
    ell(im, 20, 15, 2.4, 2.4, (255, 255, 255, 235))
    # barrel + handle
    rect(im, 17, 21, 6, 7, (28, 22, 36, 255))
    poly(im, [(13, 22), (27, 22), (24, 27), (16, 27)], (44, 32, 54, 255))
    for i in range(6):
        a = math.radians(i * 60 + 15)
        rect(im, 20 + 11 * math.cos(a), 15 + 11 * math.sin(a), 2, 2, (196, 172, 255, 200))
    grain(im, 0.16, 203)
    save(im, 'i_void')


def icon_lantern2():
    """oil lantern icon used by the new 'light' pickup"""
    W, H = 28, 34
    im = surface(W, H)
    poly(im, [(8, 16), (20, 16), (23, 30), (5, 30)], (44, 34, 40, 255))
    poly(im, [(10, 17), (18, 17), (20, 28), (8, 28)], (255, 210, 130, 235))
    glow(im, 14, 23, 15, (255, 196, 110, 170), 1.0)
    ell(im, 14, 7, 6, 5, (52, 40, 46, 255))
    rect(im, 13, 10, 2, 6, (52, 40, 46, 255))
    grain(im, 0.14, 204)
    save(im, 'i_lantern2')


def icon_medal():
    """wave/score medal for the endless mode"""
    W, H = 30, 34
    im = surface(W, H)
    for sgn in (-1, 1):
        poly(im, [(14 + sgn * 1, 2), (14 + sgn * 9, 2), (14 + sgn * 8, 22), (14 + sgn * 2, 22)], (120, 20, 36, 255))
    ell(im, 15, 22, 9, 9, (196, 160, 62, 255))
    ell(im, 15, 22, 6.6, 6.6, (232, 200, 96, 255))
    rect(im, 14, 17, 2, 10, (140, 104, 34, 255))
    rect(im, 11, 20, 8, 2, (140, 104, 34, 255))
    glow(im, 15, 22, 13, (240, 200, 90, 120), 0.7)
    grain(im, 0.16, 205)
    save(im, 'i_medal')


# ============================================================
#  BACKGROUNDS  (960x540 parallax layers, tileable horizontally)
# ============================================================
BW, BH = 1024, 576


def bg_base(top, bottom, seed):
    rnd = random.Random(seed)
    im = Image.new('RGB', (BW, BH), top)
    px = im.load()
    for y in range(BH):
        t = y / (BH - 1)
        c = (int(top[0] + (bottom[0] - top[0]) * t),
             int(top[1] + (bottom[1] - top[1]) * t),
             int(top[2] + (bottom[2] - top[2]) * t))
        for x in range(BW):
            px[x, y] = c
    return im


def bg_glow(im, cx, cy, r, color, strength=1.0):
    layer = Image.new('RGBA', im.size, (0, 0, 0, 0))
    d(layer).ellipse([cx - r, cy - r, cx + r, cy + r], fill=color + (int(255 * strength),))
    layer = layer.filter(ImageFilter.GaussianBlur(r * 0.55))
    im.paste(Image.alpha_composite(im.convert('RGBA'), layer).convert('RGB'), (0, 0))
    return im


def bg_noise(im, amount=14, seed=1):
    rnd = random.Random(seed)
    px = im.load()
    for y in range(0, BH, 1):
        for x in range(0, BW, 1):
            r, g, b = px[x, y]
            n = int((rnd.random() - 0.5) * amount)
            px[x, y] = (max(0, min(255, r + n)), max(0, min(255, g + n)), max(0, min(255, b + n)))
    return im


def bg_vignette(im, strength=0.75):
    mask = Image.new('L', (BW, BH), 0)
    md = ImageDraw.Draw(mask)
    md.ellipse([-BW * 0.25, -BH * 0.45, BW * 1.25, BH * 1.45], fill=255)
    mask = mask.filter(ImageFilter.GaussianBlur(90))
    dark = Image.new('RGB', (BW, BH), (0, 0, 0))
    k = 1 - strength
    inv = mask.point(lambda v: int(v * (1 - k) + 255 * k))
    return Image.composite(im, dark, inv)


def tree(img, x, base, h, w, color, rnd, tiers=6):
    trunk = max(1, int(w * 0.16))
    d(img).rectangle([x - trunk / 2, base - h * 0.18, x + trunk / 2, base], fill=color)
    for i in range(tiers):
        t = i / tiers
        tier_w = w * (1 - t * 0.72)
        y0 = base - h * 0.14 - i * (h * 0.82 / tiers)
        y1 = y0 - (h * 0.82 / tiers) * 1.5
        poly(img, [(x, y1), (x - tier_w / 2, y0), (x + tier_w / 2, y0)], color)


def bg_cathedral():
    """chapter 13 — a flooded nave, tall windows, a red moon through glass"""
    im = bg_base((22, 8, 20), (6, 3, 10), 301)
    rnd = random.Random(3017)
    im = bg_glow(im, BW * 0.62, BH * 0.30, 190, (188, 26, 52), 0.62)
    dl = ImageDraw.Draw(im, 'RGBA')
    # nave vault
    for i in range(7):
        x = i * (BW / 7) + 40
        poly(im, [(x, BH), (x + 46, BH), (x + 30, 70), (x + 16, 70)], (10, 6, 16, 255))
        for k in range(4):
            dl.arc([x - 18, 46 + k * 98, x + 78, 160 + k * 98], 200, 340, fill=(13, 8, 18, 255), width=5)
    # stained glass windows
    for i in range(5):
        wx = 70 + i * 205
        poly(im, [(wx, 300), (wx + 62, 300), (wx + 62, 130), (wx + 31, 96), (wx, 130)], (34, 12, 26, 255))
        for k in range(6):
            yy = 132 + k * 28
            col = [(150, 30, 52), (98, 30, 78), (170, 60, 40), (70, 34, 96)][(i + k) % 4]
            poly(im, [(wx + 6, yy), (wx + 56, yy), (wx + 56, yy + 22), (wx + 6, yy + 22)], col + (150,))
        im = bg_glow(im, wx + 31, 214, 110, (120, 30, 60), 0.42)
    # pews
    for i in range(9):
        x = 20 + i * 118
        dl.rectangle([x, BH * 0.74, x + 92, BH * 0.80], fill=(9, 5, 12, 255))
        dl.rectangle([x, BH * 0.80, x + 8, BH * 0.95], fill=(7, 4, 10, 255))
    # pillars
    for i in range(6):
        x = 30 + i * 196
        dl.rectangle([x, 60, x + 26, BH * 0.86], fill=(8, 4, 12, 255))
        dl.rectangle([x - 5, 54, x + 31, 70], fill=(12, 7, 16, 255))
    im = bg_noise(im, 12, 301)
    im = bg_vignette(im, 0.82)
    save(im, 'bg_cathedral')


def bg_pier():
    """chapter 14 — the black pier at 03:14, water, a distant ship light"""
    im = bg_base((10, 12, 24), (4, 5, 9), 401)
    rnd = random.Random(4011)
    dl = ImageDraw.Draw(im, 'RGBA')
    # moon behind clouds
    im = bg_glow(im, BW * 0.26, BH * 0.20, 150, (120, 150, 210), 0.55)
    for i in range(16):
        cx, cy = rnd.random() * BW, BH * 0.05 + rnd.random() * BH * 0.36
        dl.ellipse([cx, cy, cx + 120 + rnd.random() * 240, cy + 26 + rnd.random() * 30],
                   fill=(24, 26, 44, 70))
    # horizon city
    for i in range(34):
        x = i * 32
        h = 20 + rnd.random() * 66
        dl.rectangle([x, BH * 0.52 - h, x + 26, BH * 0.52], fill=(8, 9, 17, 255))
        for k in range(int(h / 14)):
            if rnd.random() < 0.5:
                wx = x + 4 + rnd.random() * 12
                wy = BH * 0.52 - h + 6 + k * 14
                dl.rectangle([wx, wy, wx + 3, wy + 3], fill=(120, 120, 90, 110))
    # water
    dl.rectangle([0, BH * 0.52, BW, BH], fill=(9, 13, 24, 255))
    for i in range(240):
        y = BH * 0.53 + rnd.random() * BH * 0.42
        x = rnd.random() * BW
        w = 10 + rnd.random() * 70
        a = int(36 - (y - BH * 0.52) / BH * 26)
        dl.line([x, y, x + w, y], fill=(70, 96, 140, max(6, a)), width=1)
    # pier planks
    y0 = BH * 0.76
    for i in range(22):
        x = i * 48
        dl.rectangle([x, y0, x + 44, y0 + 22], fill=(14, 10, 14, 255))
        dl.rectangle([x, y0, x + 44, y0 + 2], fill=(26, 18, 24, 255))
    for i in range(9):
        x = 40 + i * 118
        dl.rectangle([x, y0, x + 8, BH], fill=(8, 6, 10, 255))
    im = bg_noise(im, 10, 401)
    im = bg_vignette(im, 0.78)
    save(im, 'bg_pier')


def bg_cloister():
    """chapter 15 — a rain-flooded cloister with arches repeating"""
    im = bg_base((18, 16, 26), (5, 4, 8), 501)
    dl = ImageDraw.Draw(im, 'RGBA')
    rnd = random.Random(5011)
    for i in range(6):
        x = -30 + i * 186
        # arch opening
        poly(im, [(x, BH), (x + 150, BH), (x + 150, 250), (x + 75, 150), (x, 250)], (30, 26, 36, 255))
        poly(im, [(x + 14, BH), (x + 136, BH), (x + 136, 258), (x + 75, 168), (x + 14, 258)], (9, 8, 14, 255))
        # columns
        dl.rectangle([x - 16, 140, x, BH], fill=(14, 12, 20, 255))
        dl.rectangle([x - 22, 132, x + 6, 148], fill=(20, 17, 28, 255))
        # wet floor reflection
        im = bg_glow(im, x + 75, BH * 0.86, 70, (60, 70, 100), 0.30)
    # hanging vines
    for i in range(26):
        x = rnd.random() * BW
        h = 40 + rnd.random() * 130
        dl.line([x, 0, x + rnd.random() * 6 - 3, h], fill=(14, 20, 16, 200), width=2)
    # puddles
    for i in range(9):
        cx, cy = rnd.random() * BW, BH * 0.88 + rnd.random() * 40
        dl.ellipse([cx, cy, cx + 90 + rnd.random() * 120, cy + 14], fill=(22, 26, 40, 120))
    im = bg_noise(im, 11, 501)
    im = bg_vignette(im, 0.8)
    save(im, 'bg_cloister')


def bg_archive():
    """chapter 16 — the shifting archive, endless shelves"""
    im = bg_base((14, 10, 18), (5, 4, 7), 601)
    dl = ImageDraw.Draw(im, 'RGBA')
    rnd = random.Random(6011)
    for row in range(5):
        y = 90 + row * 96
        for i in range(16):
            x = i * 66
            dl.rectangle([x, y, x + 58, y + 84], fill=(10, 8, 13, 255))
            for k in range(7):
                if rnd.random() < 0.8:
                    c = rnd.choice([(60, 24, 30), (40, 30, 46), (52, 40, 28), (26, 34, 42)])
                    dl.rectangle([x + 4 + rnd.random() * 6, y + 5 + k * 11,
                                  x + 50 - rnd.random() * 10, y + 12 + k * 11], fill=c + (255,))
    im = bg_glow(im, BW * 0.5, BH * 0.16, 210, (110, 60, 30), 0.35)
    im = bg_noise(im, 13, 601)
    im = bg_vignette(im, 0.86)
    save(im, 'bg_archive')


def bg_void():
    """endless mode — an endless red hallway collapsing into itself"""
    im = bg_base((26, 4, 14), (4, 2, 7), 701)
    dl = ImageDraw.Draw(im, 'RGBA')
    rnd = random.Random(7011)
    for i in range(14):
        t = i / 14.0
        x = (i * 79) % BW
        poly(im, [(x, BH), (x + 40, BH), (x + 20 + t * 10, 0), (x + 6, 0)], (12, 4, 10, 255))
    for i in range(9):
        cy = rnd.random() * BH
        dl.line([0, cy, BW, cy + rnd.random() * 30 - 15], fill=(120, 20, 40, 60), width=2)
    for i in range(90):
        x, y = rnd.random() * BW, rnd.random() * BH
        r = 1 + rnd.random() * 2.4
        dl.ellipse([x, y, x + r, y + r], fill=(230, 90, 110, int(90 + rnd.random() * 120)))
    im = bg_glow(im, BW * 0.5, BH * 0.55, 330, (140, 10, 32), 0.5)
    im = bg_noise(im, 10, 701)
    im = bg_vignette(im, 0.88)
    save(im, 'bg_void')


def bg_mirrorhall():
    """endless mode alt — mirror hall"""
    im = bg_base((12, 14, 24), (4, 4, 9), 801)
    dl = ImageDraw.Draw(im, 'RGBA')
    rnd = random.Random(8011)
    for i in range(8):
        x = i * 132
        poly(im, [(x, BH), (x + 116, BH), (x + 116, 120), (x + 58, 60), (x, 120)], (22, 26, 40, 255))
        poly(im, [(x + 8, BH), (x + 108, BH), (x + 108, 126), (x + 58, 74), (x + 8, 126)], (10, 12, 20, 255))
        for k in range(4):
            dl.line([x + 8 + k * 26, BH, x + 58, 74], fill=(40, 50, 76, 70), width=1)
        im = bg_glow(im, x + 58, BH * 0.55, 90, (70, 100, 170), 0.22)
    for i in range(60):
        dl.line([i * 18, BH, i * 18 + 40, BH * 0.55], fill=(26, 34, 52, 60), width=1)
    im = bg_noise(im, 10, 801)
    im = bg_vignette(im, 0.84)
    save(im, 'bg_mirrorhall')


def tile_iron():
    """industrial tile for the new chapters' platforms"""
    im = Image.new('RGBA', (64, 32), (0, 0, 0, 255))
    dl = ImageDraw.Draw(im, 'RGBA')
    dl.rectangle([0, 0, 64, 32], fill=(26, 20, 26, 255))
    for y in range(0, 32, 8):
        dl.rectangle([0, y, 64, y + 7], fill=(20, 15, 22, 255))
        dl.line([0, y, 64, y], fill=(44, 34, 42, 255), width=1)
    for x in range(0, 64, 16):
        dl.ellipse([x + 5, 3, x + 8, 6], fill=(62, 48, 56, 255))
        dl.ellipse([x + 5, 19, x + 8, 22], fill=(62, 48, 56, 255))
    grain(im, 0.22, 901)
    save(im, 'tex_iron')


# ============================================================
def main():
    print('[gen_assets] monsters')
    mon_warden(); mon_drowned(); mon_bell(); mon_choir()
    mon_brute(); mon_spitter(); mon_swarm(); mon_shade()
    mon_heart(); mon_bellboss()
    print('[gen_assets] icons')
    icon_smg(); icon_rifle(); icon_void(); icon_lantern2(); icon_medal()
    print('[gen_assets] backgrounds')
    bg_cathedral(); bg_pier(); bg_cloister(); bg_archive(); bg_void(); bg_mirrorhall()
    print('[gen_assets] tiles')
    tile_iron()
    print('[gen_assets] done')


if __name__ == '__main__':
    main()

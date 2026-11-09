"""
Builds the portfolio's image assets and the 3D particle-portrait data.

    python tools/build_assets.py [--preview out.png]

Inputs  (tools/src/, kept local and git-ignored):  photo.jpg, swoc-badge.png, ties-logo.jpg
Outputs (assets/):     img/rishikesh.jpg, img/swoc-badge.webp, img/ties.jpg,
                       js/portrait-data.js  (particle portrait as a halftone dot grid)

Needs numpy, Pillow and opencv-python.
"""

from __future__ import annotations

import argparse
import base64
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "tools" / "src"
IMG = ROOT / "assets" / "img"
JS = ROOT / "assets" / "js"

# Person silhouette in the 1440x1440 source photo (hair, head, neck, shoulders).
SILHOUETTE = [
    (640, 38), (760, 52), (850, 128), (888, 258), (898, 420), (884, 540),
    (850, 612), (905, 606), (1060, 735), (1250, 815), (1345, 900),
    (1398, 1100), (1412, 1440), (168, 1440), (186, 1150), (232, 905),
    (322, 792), (470, 720), (540, 690), (505, 622), (462, 545), (440, 420),
    (426, 282), (468, 142), (552, 68),
]


def build_images():
    IMG.mkdir(parents=True, exist_ok=True)
    photo = Image.open(SRC / "photo.jpg").convert("RGB")
    # 4:5 portrait crop that keeps the face centred and drops the neighbour at the far left
    crop = photo.crop((190, 30, 1250, 1355)).resize((960, 1200), Image.LANCZOS)
    crop.save(IMG / "rishikesh.jpg", quality=86, optimize=True, progressive=True)

    badge = Image.open(SRC / "swoc-badge.png").convert("RGBA")
    w = 560
    badge = badge.resize((w, round(badge.height * w / badge.width)), Image.LANCZOS)
    badge.save(IMG / "swoc-badge.webp", quality=88, method=6)

    Image.open(SRC / "ties-logo.jpg").convert("RGB").save(IMG / "ties.jpg", quality=90)


# The hair is near-black against dark leaves, so GrabCut trims it; this outline
# (traced on a brightened copy of the photo) restores its full volume.
HAIR = [
    (472, 420), (433, 410), (430, 370), (427, 330), (424, 290), (423, 250), (424, 210),
    (432, 160), (452, 112), (482, 70), (518, 40),
    (565, 20), (630, 12), (700, 14), (755, 28), (798, 56), (830, 96), (860, 140),
    (882, 190), (892, 245), (896, 300), (890, 345), (700, 330), (520, 340),
]
# The ear and sideburn on the left of the photo, which GrabCut clips into a straight edge.
EAR = [
    (466, 336), (450, 342), (440, 372), (437, 405), (433, 428), (433, 455), (438, 480),
    (447, 505), (457, 524), (468, 542), (478, 440),
]
HEAD = (668, 380, 236, 330)       # head (hair to chin) ellipse in source px: centre x, y, radius x, y
FACE = (676, 452, 196, 262)       # skin of the face (brows to chin)
STEP = 5                          # dot pitch in source pixels
CENTRE, SCALE = (790.0, 690.0), 620.0  # source pixel -> portrait units ([-1, 1] tall)


def person_mask(photo_bgr: np.ndarray) -> np.ndarray:
    """Exact cut-out of the person: GrabCut, seeded from the hand-drawn outline."""
    import cv2

    H, W = photo_bgr.shape[:2]
    poly = Image.new("L", (W, H), 0)
    ImageDraw.Draw(poly).polygon(SILHOUETTE, fill=255)
    poly = np.asarray(poly) > 0
    disk = lambda r: cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * r + 1, 2 * r + 1))
    gc = np.full((H, W), cv2.GC_BGD, np.uint8)
    gc[cv2.dilate(poly.astype(np.uint8), disk(40)) > 0] = cv2.GC_PR_BGD
    gc[poly] = cv2.GC_PR_FGD
    gc[cv2.erode(poly.astype(np.uint8), disk(45)) > 0] = cv2.GC_FGD
    cv2.grabCut(photo_bgr, gc, None, np.zeros((1, 65)), np.zeros((1, 65)), 8, cv2.GC_INIT_WITH_MASK)
    fg = ((gc == cv2.GC_FGD) | (gc == cv2.GC_PR_FGD)).astype(np.uint8)
    traced = Image.new("L", (W, H), 0)
    ImageDraw.Draw(traced).polygon(HAIR, fill=255)
    ImageDraw.Draw(traced).polygon(EAR, fill=255)
    fg |= (np.asarray(traced) > 0).astype(np.uint8)

    # largest piece only, holes filled, edge smoothed
    _, lab, stats, _ = cv2.connectedComponentsWithStats(fg, 8)
    fg = (lab == 1 + np.argmax(stats[1:, cv2.CC_STAT_AREA])).astype(np.uint8)
    fg = cv2.morphologyEx(fg, cv2.MORPH_CLOSE, disk(6))
    n, lab, stats, _ = cv2.connectedComponentsWithStats(1 - fg, 4)
    for i in range(1, n):
        x, y, w, h, _ = stats[i]
        if x > 0 and y > 0 and x + w < W and y + h < H:
            fg[lab == i] = 1
    return cv2.GaussianBlur(fg.astype(np.float32), (0, 0), 4) > 0.5


def portrait_tone(rgb: np.ndarray, mask: np.ndarray) -> np.ndarray:
    """Per-pixel dot brightness in [0, 1]: the face gets local contrast so eyes,
    brows, smile and beard read; the shirt is dimmed so the face leads."""
    import cv2

    H, W = mask.shape
    lum = 0.2126 * rgb[..., 0] + 0.7152 * rgb[..., 1] + 0.0722 * rgb[..., 2]
    yy, xx = np.mgrid[0:H, 0:W]
    hx, hy, hrx, hry = HEAD
    e = np.sqrt(((xx - hx) / hrx) ** 2 + ((yy - hy) / hry) ** 2)
    head_w = np.clip((1.12 - e) / 0.2, 0, 1)            # 1 on the head, 0 past the neck

    clahe = cv2.createCLAHE(clipLimit=1.6, tileGridSize=(8, 8))
    local = clahe.apply(np.round(lum * 255).astype(np.uint8)).astype(np.float32) / 255
    face_l = cv2.GaussianBlur(0.35 * local + 0.65 * lum, (0, 0), 1.2)

    def stretch(v, region, lo_p, hi_p, gamma):
        lo, hi = np.percentile(v[region], lo_p), np.percentile(v[region], hi_p)
        return np.clip((v - lo) / (hi - lo + 1e-6), 0, 1) ** gamma

    face_t = stretch(face_l, mask & (head_w > 0.9), 2, 99.9, 0.85)
    body_t = stretch(lum, mask & (head_w < 0.1), 1, 99.7, 1.35) * 0.5
    tone = head_w * face_t + (1 - head_w) * body_t

    # hair is near-black on a near-black page: give it a dim floor plus its own
    # sheen, so the hairstyle (a big part of the likeness) reads
    fx, fy, frx, fry = FACE
    off_face = np.clip((np.sqrt(((xx - fx) / frx) ** 2 + ((yy - fy) / fry) ** 2) - 0.92) / 0.16, 0, 1)
    hair = head_w * off_face * (yy < 640)
    hair_l = cv2.GaussianBlur(lum, (0, 0), 1.5) ** 0.5   # lift the shadows to find the strands
    sheen = stretch(hair_l, mask & (hair > 0.5), 3, 99.5, 1.2)
    tone = np.maximum(tone, hair * (0.08 + 0.42 * sheen))

    # the ear on the left sits in shadow: lift it so it reads as an ear
    ear = np.zeros((H, W), np.float32)
    cv2.fillPoly(ear, [np.array(EAR, np.int32)], 1.0)
    ear = cv2.GaussianBlur(ear, (0, 0), 6)
    tone = tone * (1 - ear) + tone ** 0.62 * ear

    # soft rim light along the outline (hair, ears, shoulders)
    inside = cv2.distanceTransform(mask.astype(np.uint8), cv2.DIST_L2, 5)
    tone = np.maximum(tone, 0.36 * np.exp(-inside / 7.0))
    tone = np.maximum(tone, 0.06)                        # floor: the silhouette never vanishes
    fade = np.clip((1310 - yy) / 260, 0, 1) ** 1.4       # fade out towards the waist
    return tone * mask * fade, head_w


def portrait_depth(mask: np.ndarray) -> np.ndarray:
    """Depth in portrait units: an inflated silhouette plus a rounder head."""
    import cv2

    H, W = mask.shape
    dist = cv2.distanceTransform(mask.astype(np.uint8), cv2.DIST_L2, 5)
    body = np.sqrt(1 - (1 - np.clip(dist / 230, 0, 1)) ** 2) * 0.2
    yy, xx = np.mgrid[0:H, 0:W]
    hx, hy, hrx, hry = HEAD
    dh = 1 - ((xx - hx) / hrx) ** 2 - ((yy - hy) / hry) ** 2
    head = np.sqrt(np.clip(dh, 0, 1)) * 0.3
    return np.maximum(body, head)


def build_portrait(preview: Path | None = None):
    import cv2

    bgr = cv2.imread(str(SRC / "photo.jpg"))
    rgb = bgr[..., ::-1].astype(np.float32) / 255
    mask = person_mask(bgr)
    tone, head_w = portrait_tone(rgb, mask)
    depth = portrait_depth(mask)

    # average each quantity over its STEP x STEP cell (no aliasing)
    ys, xs = np.nonzero(tone > 0)
    x0, y0 = xs.min() // STEP * STEP, ys.min() // STEP * STEP
    cols, rows = (xs.max() - x0) // STEP + 1, (ys.max() - y0) // STEP + 1
    crop = lambda a: a[y0:y0 + rows * STEP, x0:x0 + cols * STEP].astype(np.float32)
    cell = lambda a: cv2.resize(crop(a), (cols, rows), interpolation=cv2.INTER_AREA)
    t, cov, hw, z = cell(tone), cell(mask), cell(head_w), cell(depth)

    keep = (cov > 0.5) & (t > 0.02)
    t = np.where(keep, t / np.maximum(cov, 1e-3), 0)

    tone_u8 = np.where(keep, np.clip(np.round(t * 254), 1, 255), 0).astype(np.uint8)
    z_u8 = np.clip(np.round(z[keep] / 0.5 * 255), 0, 255).astype(np.uint8)
    n = int(keep.sum())

    cx, cy = CENTRE
    meta = dict(cols=int(cols), rows=int(rows), step=STEP / SCALE,
                x0=(x0 + STEP / 2 - cx) / SCALE, y0=-(y0 + STEP / 2 - cy) / SCALE, zmax=0.5)
    b64 = lambda a: base64.b64encode(a.tobytes()).decode()
    JS.mkdir(parents=True, exist_ok=True)
    (JS / "portrait-data.js").write_text(
        "// Generated by tools/build_assets.py: particle portrait as a dot grid.\n"
        "// tone: cols x rows uint8, row-major from the top (0 = no dot); depth: uint8 per dot,\n"
        "// in the same order, scaled to [0, zmax]. Positions are in portrait units.\n"
        "window.PORTRAIT = { n: %d, cols: %d, rows: %d, step: %.6f, x0: %.6f, y0: %.6f, zmax: %.2f,\n"
        "  tone: \"%s\",\n  depth: \"%s\" };\n"
        % (n, meta["cols"], meta["rows"], meta["step"], meta["x0"], meta["y0"], meta["zmax"], b64(tone_u8), b64(z_u8)),
        encoding="utf-8",
    )
    size_kb = (JS / "portrait-data.js").stat().st_size / 1024
    print(f"portrait: {n} dots on a {cols}x{rows} grid, {size_kb:.0f} KB")

    if preview:
        # rough stand-in for the WebGL render: soft additive dots, size and brightness from tone
        S = 3
        img = np.zeros((rows * S * 2, cols * S * 2), np.float32)
        rr, cc = np.nonzero(keep)
        tv = t[rr, cc]
        for lo, hi in ((0, 0.25), (0.25, 0.5), (0.5, 0.75), (0.75, 1.01)):
            sel = (tv >= lo) & (tv < hi)
            imp = np.zeros_like(img)
            np.add.at(imp, (rr[sel] * 2 * S + S, cc[sel] * 2 * S + S), 0.25 + 0.75 * tv[sel])
            rad = (0.5 + 1.2 * (lo + hi) / 2) * S
            k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (int(2 * rad) | 1, int(2 * rad) | 1)).astype(np.float32)
            img += cv2.filter2D(imp, -1, cv2.GaussianBlur(k, (0, 0), rad / 3))
        img = np.clip(img / np.percentile(img[img > 0], 99.5), 0, 1)
        col = np.array([221, 235, 242], np.float32)  # cream, BGR
        cv2.imwrite(str(preview), (img[..., None] * col + (1 - img[..., None]) * np.array([13, 11, 11])).astype(np.uint8))
        print(f"preview: {preview}")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--preview", type=Path)
    args = ap.parse_args()
    build_images()
    build_portrait(preview=args.preview)

"""
Builds the portfolio's image assets and the 3D particle-portrait data.

    python tools/build_assets.py [--preview out.png]

Inputs  (tools/src/, kept local and git-ignored):  photo.jpg, swoc-badge.png, ties-logo.jpg
Outputs (assets/):     img/rishikesh.jpg, img/swoc-badge.webp, img/ties.jpg,
                       js/portrait-data.js  (particle portrait point cloud)
"""

from __future__ import annotations

import argparse
import base64
import math
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

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


def build_portrait(n_points=16000, preview: Path | None = None, seed=7):
    rng = np.random.default_rng(seed)
    photo = Image.open(SRC / "photo.jpg").convert("RGB")
    S = 360  # working resolution
    k = photo.width / S
    small = photo.resize((S, S), Image.LANCZOS)
    rgb = np.asarray(small).astype(np.float32) / 255.0
    lum = 0.2126 * rgb[..., 0] + 0.7152 * rgb[..., 1] + 0.0722 * rgb[..., 2]

    # silhouette mask
    mask_img = Image.new("L", (S, S), 0)
    ImageDraw.Draw(mask_img).polygon([(x / k, y / k) for x, y in SILHOUETTE], fill=255)
    mask_img = mask_img.filter(ImageFilter.GaussianBlur(0.6))
    mask = np.asarray(mask_img) > 128

    # drop foliage that shows through inside the outline (green-dominant pixels)
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    leafy = (g > r * 1.08) & (g > b * 1.02)
    mask &= ~leafy

    # edge strength: features (eyes, brows, mouth, collar, stripes)
    gx = np.zeros_like(lum)
    gy = np.zeros_like(lum)
    gx[:, 1:-1] = lum[:, 2:] - lum[:, :-2]
    gy[1:-1, :] = lum[2:, :] - lum[:-2, :]
    edge = np.clip(np.hypot(gx, gy) * 3.0, 0, 1)

    # head region (in working-resolution pixels)
    yy, xx = np.mgrid[0:S, 0:S]
    hx, hy, hrx, hry = 668 / k, 372 / k, 238 / k, 330 / k
    head = (((xx - hx) / hrx) ** 2 + ((yy - hy) / hry) ** 2) < 1.0

    # contrast stretch: face and body separately, so skin detail (eyes, brows,
    # smile, beard) survives next to the much brighter shirt
    bright = np.zeros_like(lum)
    for region, lo_p, hi_p, gamma in ((mask & head, 3, 99.8, 1.3), (mask & ~head, 2, 99, 1.1)):
        lv = lum[region]
        lo, hi = np.percentile(lv, lo_p), np.percentile(lv, hi_p)
        bright[region] = np.clip((lum[region] - lo) / (hi - lo + 1e-6), 0, 1) ** gamma

    region_boost = np.where(head, 2.1, 0.5)
    weight = (0.07 + 1.0 * bright + np.where(head, 0.85, 1.1) * edge) * region_boost * mask
    ys, xs = np.nonzero(weight > 0)
    w = weight[ys, xs]
    p = w / w.sum()
    idx = rng.choice(len(xs), size=min(n_points, len(xs) * 3), replace=True, p=p)

    px = xs[idx] + rng.random(len(idx))  # sub-pixel jitter
    py = ys[idx] + rng.random(len(idx))
    pb = np.clip(bright[ys[idx], xs[idx]] * 0.85 + edge[ys[idx], xs[idx]] * 0.6, 0.08, 1)

    # back to source coordinates
    X = px * k
    Y = py * k

    # depth: head ellipsoid + soft torso bulge + a little luminance relief
    hx, hy, hrx, hry = 668, 372, 238, 330
    dh = 1 - ((X - hx) / hrx) ** 2 - ((Y - hy) / hry) ** 2
    z_head = np.sqrt(np.clip(dh, 0, 1)) * 0.42
    db = 1 - ((X - 790) / 660) ** 2
    z_body = np.sqrt(np.clip(db, 0, 1)) * 0.22 * (Y > 640)
    Z = np.maximum(z_head, z_body) + pb * 0.05 + rng.normal(0, 0.012, len(X))

    # normalise: centre on the silhouette, fit height to [-1, 1]
    cx, cy = 790.0, 740.0
    scale = 700.0
    nx = (X - cx) / scale
    ny = -(Y - cy) / scale
    nz = Z

    q = lambda a: np.clip(np.round(a * 16000), -32767, 32767).astype("<i2")
    buf = np.stack([q(nx), q(ny), q(nz)], axis=1).tobytes() + np.round(pb * 255).astype("u1").tobytes()
    b64 = base64.b64encode(buf).decode()
    JS.mkdir(parents=True, exist_ok=True)
    (JS / "portrait-data.js").write_text(
        "// Generated by tools/build_assets.py: particle portrait point cloud.\n"
        "// Layout: N x (int16 x, int16 y, int16 z) scaled by 1/16000, then N x uint8 brightness.\n"
        f"window.PORTRAIT = {{ n: {len(nx)}, data: \"{b64}\" }};\n",
        encoding="utf-8",
    )
    print(f"portrait: {len(nx)} points, {len(b64) / 1024:.0f} KB base64")

    if preview:
        W = 900
        img = Image.new("RGB", (W, W), (11, 11, 13))
        d = ImageDraw.Draw(img, "RGBA")
        for x, y, br in zip(nx, ny, pb):
            u = W / 2 + x * W * 0.42
            v = W / 2 - y * W * 0.42
            a = int(40 + 215 * br)
            s = 0.7 + 1.0 * br
            d.ellipse((u - s, v - s, u + s, v + s), fill=(242, 235, 221, a))
        img.save(preview)
        print(f"preview: {preview}")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--preview", type=Path)
    args = ap.parse_args()
    build_images()
    build_portrait(preview=args.preview)

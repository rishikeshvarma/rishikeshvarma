"""
Renders the social card, the README banner and the favicons from
tools/cards.html with headless Chrome (Playwright).

    python tools/build_cards.py
"""

from pathlib import Path

from PIL import Image
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
IMG = ROOT / "assets" / "img"
PAGE = (ROOT / "tools" / "cards.html").as_uri()

JOBS = [
    ("og", "og-card.png", 1),          # 1200 x 630
    ("banner", "readme-banner.png", 2),  # 2560 x 800
    ("favicon", "favicon-512.png", 1),   # 512 x 512
]


def main():
    IMG.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as p:
        browser = p.chromium.launch(channel="chrome", args=["--allow-file-access-from-files"])
        for card, name, dpr in JOBS:
            page = browser.new_page(viewport={"width": 1400, "height": 900}, device_scale_factor=dpr)
            page.goto(f"{PAGE}?card={card}")
            page.wait_for_selector("body[data-ready='1']", timeout=20000)
            page.wait_for_timeout(300)
            el = page.query_selector("#c")
            el.screenshot(path=str(IMG / name), omit_background=True)
            page.close()
            print("wrote", name)
        browser.close()

    # README banner as WebP (about a seventh of the PNG size)
    Image.open(IMG / "readme-banner.png").save(IMG / "readme-banner.webp", quality=90, method=6)
    (IMG / "readme-banner.png").unlink()
    Image.open(IMG / "og-card.png").convert("RGB").save(IMG / "og-card.png", optimize=True)

    fav = Image.open(IMG / "favicon-512.png").convert("RGBA")
    for size in (32, 180, 192):
        fav.resize((size, size), Image.LANCZOS).save(IMG / f"favicon-{size}.png", optimize=True)
    (IMG / "favicon-512.png").unlink()
    print("wrote favicons")


if __name__ == "__main__":
    main()

"""Collect a product's brand tokens from its codebase / landing page source.

Usage: python3 extract_brand.py <repo-or-site-dir> [--copy-to <film-project>]

Finds:
  - CSS custom properties holding colours (--brand-*, --color-*, …) and the most used hex colours
  - font families and @font-face files (woff2/woff/ttf/otf)
  - logo / icon files (svg/png with logo|icon|brand|mark in the path)
Prints a summary and writes brand.json next to the film project (or cwd).
With --copy-to it also copies fonts → public/fonts and logos → public/brand.

It only gathers candidates — read the summary, open the logo files, and decide
which colours are the real primary/ink/surface ones before using them.
"""

import json
import re
import shutil
import sys
from collections import Counter
from pathlib import Path

root = Path(sys.argv[1]).expanduser().resolve()
dest = None
if "--copy-to" in sys.argv:
    dest = Path(sys.argv[sys.argv.index("--copy-to") + 1]).expanduser().resolve()

SKIP = {"node_modules", ".git", "dist", "build", ".next", ".astro", "out", "coverage", ".venv"}
STYLE_EXT = {".css", ".scss", ".sass", ".less", ".astro", ".vue", ".svelte", ".tsx", ".jsx", ".ts", ".js", ".html"}
HEX = re.compile(r"#(?:[0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b")
VAR = re.compile(r"(--[\w-]+)\s*:\s*([^;}{<>\"\n]{1,80})[;}]")
FAMILY = re.compile(r"font-family\s*:\s*([^;}{]+)")
FONTFILE = re.compile(r"url\(\s*['\"]?([^'\")]+\.(?:woff2?|ttf|otf))['\"]?\s*\)")


def files():
    for p in root.rglob("*"):
        if any(part in SKIP for part in p.parts):
            continue
        if p.is_file():
            yield p


hexes, variables, families, fontfiles, logos, fonts_on_disk = Counter(), {}, Counter(), set(), [], []
for p in files():
    low = str(p.relative_to(root)).lower()
    if p.suffix.lower() in {".woff2", ".woff", ".ttf", ".otf"}:
        fonts_on_disk.append(p)
    if p.suffix.lower() in {".svg", ".png"} and re.search(r"logo|icon|brand|mark|favicon", low) and p.stat().st_size < 400_000:
        logos.append(p)
    if p.suffix.lower() not in STYLE_EXT or p.stat().st_size > 2_000_000:
        continue
    text = p.read_text(errors="ignore")
    hexes.update(h.lower() for h in HEX.findall(text))
    for name, value in VAR.findall(text):
        value = value.strip()
        if HEX.search(value) or value.startswith(("rgb", "hsl", "oklch", "color-mix")):
            variables.setdefault(name, value)
    for fam in FAMILY.findall(text):
        families[fam.strip().split(",")[0].strip("'\" ")] += 1
    fontfiles.update(FONTFILE.findall(text))

brand = {
    "source": str(root),
    "colors_by_use": hexes.most_common(16),
    "color_variables": dict(list(variables.items())[:60]),
    "font_families": families.most_common(6),
    "font_files": sorted({str(p.relative_to(root)) for p in fonts_on_disk})[:24],
    "logos": sorted(str(p.relative_to(root)) for p in logos)[:24],
}

print(f"brand candidates from {root}\n")
print("most used colours:", ", ".join(f"{h}×{n}" for h, n in brand["colors_by_use"]))
print("\ncolour variables:")
for k, v in list(brand["color_variables"].items())[:30]:
    print(f"  {k}: {v}")
print("\nfont families:", brand["font_families"])
print("font files:", *brand["font_files"], sep="\n  ")
print("logo / icon files:", *brand["logos"], sep="\n  ")

out_dir = dest or Path.cwd()
(out_dir / "brand.json").write_text(json.dumps(brand, indent=2, ensure_ascii=False))
print(f"\n→ {out_dir / 'brand.json'}")
if dest:
    (dest / "public/fonts").mkdir(parents=True, exist_ok=True)
    (dest / "public/brand").mkdir(parents=True, exist_ok=True)
    for f in fonts_on_disk[:12]:
        if f.suffix.lower() in {".woff2", ".woff"}:
            shutil.copy2(f, dest / "public/fonts" / f.name)
    for l in logos[:12]:
        shutil.copy2(l, dest / "public/brand" / l.name)
    print(f"copied fonts → {dest / 'public/fonts'}, logos → {dest / 'public/brand'}")

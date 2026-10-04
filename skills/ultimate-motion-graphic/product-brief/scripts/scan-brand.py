#!/usr/bin/env python3
"""Inventory a codebase's visual language: fonts, colour tokens, the colours actually used, radii and shadows.

    python3 scan-brand.py [root] [--json]

Reads CSS, SCSS, Astro, Vue, Svelte, JSX/TSX and HTML under root (default .), skipping build output and
dependencies. Counts, it does not judge: the most-used colour is not necessarily the brand colour, and
a token that is defined is not necessarily used. Read the result next to screenshots. Stdlib only.
"""
import argparse
import collections
import json
import os
import re

parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
parser.add_argument("root", nargs="?", default=".")
parser.add_argument("--json", action="store_true")
args = parser.parse_args()

SKIP = {"node_modules", "dist", "build", ".next", ".astro", ".git", ".turbo", "coverage", "out", ".svelte-kit", ".claude"}
EXTENSIONS = (".css", ".scss", ".sass", ".less", ".astro", ".vue", ".svelte", ".jsx", ".tsx", ".html")
COLOR = re.compile(r"#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)|hsla?\([^)]*\)|oklch\([^)]*\)")

fonts_declared = collections.OrderedDict()
font_stacks = collections.Counter()
tokens = collections.OrderedDict()
colors = collections.Counter()
radii = collections.Counter()
shadows = collections.Counter()
font_sizes = collections.Counter()
files = 0
tailwind = []

for directory, folders, names in os.walk(args.root):
    folders[:] = [f for f in folders if f not in SKIP and not f.startswith(".")]
    for name in names:
        path = os.path.join(directory, name)
        if name.startswith("tailwind.config"):
            tailwind.append(os.path.relpath(path, args.root))
        if not name.endswith(EXTENSIONS):
            continue
        try:
            text = open(path, encoding="utf-8", errors="ignore").read()
        except OSError:
            continue
        files += 1
        relative = os.path.relpath(path, args.root)
        for block in re.findall(r"@font-face\s*{([^}]*)}", text):
            family = re.search(r"font-family:\s*['\"]?([^;'\"]+)", block)
            source = re.search(r"url\(([^)]+)\)", block)
            weight = re.search(r"font-weight:\s*([^;]+)", block)
            if family:
                entry = fonts_declared.setdefault(family.group(1).strip(), {"weights": set(), "files": set()})
                if weight:
                    entry["weights"].add(weight.group(1).strip())
                if source:
                    entry["files"].add(source.group(1).strip("'\" "))
        for stack in re.findall(r"font-family:\s*([^;}\n]+)", text):
            font_stacks[stack.strip()] += 1
        for name_, value in re.findall(r"(--[\w-]+)\s*:\s*([^;}\n]+)", text):
            value = value.strip()
            if "${" in value or "<" in value or "{" in value:
                continue  # template expressions, not tokens
            if COLOR.search(value) or re.search(r"font|radius|shadow|space|gap|size|max", name_):
                tokens.setdefault(name_, {"value": value, "file": relative})
        for color in COLOR.findall(text):
            colors[re.sub(r"\s+", " ", color.lower())] += 1
        for radius in re.findall(r"border-radius:\s*([^;}\n]+)", text):
            radii[radius.strip()] += 1
        for shadow in re.findall(r"box-shadow:\s*([^;}\n]+)", text):
            shadows[shadow.strip()] += 1
        for size in re.findall(r"font-size:\s*([^;}\n]+)", text):
            font_sizes[size.strip()] += 1

result = {
    "files_scanned": files,
    "tailwind_configs": tailwind,
    "fonts_declared": {k: {"weights": sorted(v["weights"]), "files": sorted(v["files"])[:4]} for k, v in fonts_declared.items()},
    "font_stacks": font_stacks.most_common(6),
    "tokens": dict(list(tokens.items())[:80]),
    "colors_by_use": colors.most_common(30),
    "radii": radii.most_common(8),
    "shadows": shadows.most_common(6),
    "font_sizes": font_sizes.most_common(12),
}

if args.json:
    print(json.dumps(result, indent=1, ensure_ascii=False))
else:
    print(f"# Brand scan of {os.path.abspath(args.root)} ({files} files)\n")
    if tailwind:
        print("Tailwind config:", ", ".join(tailwind), "— read its theme for the named palette.\n")
    print("## Fonts (@font-face)")
    for family, info in result["fonts_declared"].items():
        print(f"- {family}: weights {', '.join(info['weights']) or '?'} · {', '.join(info['files'])}")
    print("\n## font-family stacks in use")
    for stack, count in result["font_stacks"]:
        print(f"- {count}× {stack}")
    print("\n## Custom properties (colour / type / radius / spacing)")
    for name_, info in result["tokens"].items():
        print(f"- {name_}: {info['value']}  ({info['file']})")
    print("\n## Colours by number of uses")
    for color, count in result["colors_by_use"]:
        print(f"- {count}× {color}")
    print("\n## Radii")
    for value, count in result["radii"]:
        print(f"- {count}× {value}")
    print("\n## Shadows")
    for value, count in result["shadows"]:
        print(f"- {count}× {value}")
    print("\n## Font sizes")
    print(", ".join(f"{value} ({count}×)" for value, count in result["font_sizes"]))

#!/usr/bin/env python3
"""Extract a repo's design tokens as a flat name -> value map.

Reads the canonical :root block so a design is drawn from live values rather
than remembered ones. Comments are stripped first (they carry contrast
measurements and KEEP IN SYNC notes, not values) and multi-line declarations
like --font-sans are joined.

  python3 extract-tokens.py                        # table, repo-relative default
  python3 extract-tokens.py --json                 # {"--card": "#ffffff", ...}
  python3 extract-tokens.py --group                # grouped by kind
  python3 extract-tokens.py --css path/to/file.css # another :root source
"""

import argparse
import json
import pathlib
import re
import sys

DEFAULT_CSS = "packages/ui/src/tokens.css"  # override with --css

DECL = re.compile(r"(--[a-z0-9-]+)\s*:\s*([^;]+);")
COMMENT = re.compile(r"/\*.*?\*/", re.S)


def extract(css_text: str) -> dict[str, str]:
    stripped = COMMENT.sub("", css_text)
    return {
        name: " ".join(value.split())
        for name, value in DECL.findall(stripped)
    }


def kind_of(name: str, value: str) -> str:
    if re.match(r"^#[0-9a-fA-F]{3,8}$", value) or value.startswith(("rgb", "hsl")):
        return "color"
    if name.startswith(("--r-", "--radius")):
        return "radius"
    if name.startswith("--spacing"):
        return "spacing"
    if name.startswith("--font"):
        return "font"
    return "other"


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--css", default=DEFAULT_CSS)
    parser.add_argument("--json", action="store_true")
    parser.add_argument("--group", action="store_true")
    args = parser.parse_args()

    path = pathlib.Path(args.css)
    if not path.exists():
        print(f"not found: {path} (run from the repo root, or pass --css)", file=sys.stderr)
        return 1

    tokens = extract(path.read_text())
    if not tokens:
        print(f"no custom properties found in {path}", file=sys.stderr)
        return 1

    if args.json:
        print(json.dumps(tokens, indent=2))
        return 0

    if args.group:
        grouped: dict[str, list[tuple[str, str]]] = {}
        for name, value in tokens.items():
            grouped.setdefault(kind_of(name, value), []).append((name, value))
        for kind in ("color", "radius", "spacing", "font", "other"):
            rows = grouped.get(kind)
            if not rows:
                continue
            print(f"\n## {kind} ({len(rows)})")
            for name, value in rows:
                print(f"  {name:<34} {value}")
        print(f"\ntotal: {len(tokens)}")
        return 0

    for name, value in tokens.items():
        print(f"{name:<34} {value}")
    print(f"\ntotal: {len(tokens)}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

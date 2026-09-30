#!/usr/bin/env python3
"""Probe a repo for the facts the des-eng flow needs.

Reports; decides nothing. Every finding carries the evidence that produced it,
so a human can confirm or overrule it. Python 3 stdlib only — no install step.

    python3 probe-repo.py [--root .] [--json]
"""
from __future__ import annotations

import argparse
import json
import os
import re
from collections import Counter
from pathlib import Path

SKIP = {
    "node_modules", ".git", "dist", "build", ".next", ".turbo", "coverage",
    "out", ".cache", "storybook-static", "__snapshots__", ".venv", "vendor",
}
STYLE_DEPS = {
    "tailwindcss": "Tailwind",
    "class-variance-authority": "cva",
    "clsx": "clsx",
    "tailwind-merge": "tailwind-merge",
    "styled-components": "styled-components",
    "@emotion/react": "Emotion",
    "@vanilla-extract/css": "vanilla-extract",
    "@stitches/react": "Stitches",
    "sass": "Sass",
}


def walk(root: Path):
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if d not in SKIP and not d.startswith(".")
                       or d in {".storybook"}]
        for name in filenames:
            yield Path(dirpath) / name


def rel(p: Path, root: Path) -> str:
    try:
        return str(p.relative_to(root))
    except ValueError:
        return str(p)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--root", default=".")
    ap.add_argument("--json", action="store_true")
    args = ap.parse_args()
    root = Path(args.root).resolve()

    files = list(walk(root))

    stories, tests, pkgjsons, cssfiles, sbdirs, convfiles = [], [], [], [], [], []
    for f in files:
        n = f.name
        if re.search(r"\.stories\.[jt]sx?$", n):
            stories.append(f)
        elif re.search(r"\.(test|spec)\.[jt]sx?$", n):
            tests.append(f)
        elif n == "package.json":
            pkgjsons.append(f)
        elif n.endswith(".css"):
            cssfiles.append(f)
        elif n in {"CLAUDE.md", "AGENTS.md", "CONTRIBUTING.md"}:
            convfiles.append(f)
        if f.parent.name == ".storybook" and n.startswith("main."):
            sbdirs.append(f)

    # ── where do shared components live? most stories wins ──────────────────
    story_pkgs = Counter()
    for s in stories:
        parts = rel(s, root).split(os.sep)
        story_pkgs[os.sep.join(parts[:2]) if len(parts) > 1 else parts[0]] += 1

    # ── token files: css declaring custom properties in a :root-ish block ────
    token_files = []
    for c in cssfiles:
        try:
            text = c.read_text(errors="ignore")
        except OSError:
            continue
        decls = re.findall(r"^\s*(--[a-zA-Z0-9-]+)\s*:\s*([^;]+);", text, re.M)
        if len(decls) >= 5:
            token_files.append({
                "path": rel(c, root),
                "count": len(decls),
                "sample": [d[0] for d in decls[:12]],
                "families": sorted({d[0].split("-")[3] for d in decls
                                    if d[0].startswith("--color-") and len(d[0].split("-")) > 3}),
            })
    token_files.sort(key=lambda t: -t["count"])

    # ── styling + component stack from every package.json ───────────────────
    deps_found, scripts, workspace_names = set(), {}, []
    for pj in pkgjsons:
        try:
            data = json.loads(pj.read_text(errors="ignore"))
        except (OSError, json.JSONDecodeError):
            continue
        allderps = {**data.get("dependencies", {}), **data.get("devDependencies", {})}
        for dep, label in STYLE_DEPS.items():
            if dep in allderps:
                deps_found.add(label)
        if any(d.startswith("@radix-ui/") for d in allderps):
            deps_found.add("Radix")
        if any(d.startswith("@storybook/") for d in allderps):
            deps_found.add("Storybook")
        name = data.get("name")
        if name:
            workspace_names.append({"name": name, "path": rel(pj.parent, root)})
        if pj.parent == root:
            scripts = data.get("scripts", {})

    # ── testing convention in the story-heaviest package ────────────────────
    top_pkg = story_pkgs.most_common(1)[0][0] if story_pkgs else None
    convention = None
    if top_pkg:
        s_in = sum(1 for s in stories if rel(s, root).startswith(top_pkg))
        t_in = sum(1 for t in tests if rel(t, root).startswith(top_pkg))
        convention = {
            "package": top_pkg, "stories": s_in, "tests": t_in,
            "reading": "stories only — do not add tests here" if t_in == 0
                       else ("stories dominate" if s_in > t_in * 2
                             else "both stories and tests are normal here"),
        }

    # ── barrels ─────────────────────────────────────────────────────────────
    barrels = [rel(f, root) for f in files
               if f.name in {"index.ts", "index.tsx"}
               and top_pkg and rel(f, root).startswith(top_pkg)
               and f.stat().st_size > 2000]

    # ── story title prefixes, so new stories match the existing tree ────────
    titles = Counter()
    for s in stories[:400]:
        try:
            m = re.search(r"""title:\s*["'`]([^"'`]+)""", s.read_text(errors="ignore"))
        except OSError:
            continue
        if m:
            titles[m.group(1).split("/")[0]] += 1

    report = {
        "root": str(root),
        "ui_package_candidates": story_pkgs.most_common(5),
        "barrels": barrels[:5],
        "token_files": token_files[:5],
        "stack": sorted(deps_found),
        "storybook_configs": [rel(f, root) for f in sbdirs],
        "root_scripts": {k: v for k, v in scripts.items()
                         if re.search(r"lint|typecheck|test|storybook|check", k)},
        "testing_convention": convention,
        "story_title_roots": titles.most_common(10),
        "conventions_files": [rel(f, root) for f in convfiles],
        "workspaces": workspace_names[:25],
        "counts": {"stories": len(stories), "tests": len(tests),
                   "css": len(cssfiles), "packages": len(pkgjsons)},
    }

    if args.json:
        print(json.dumps(report, indent=2))
        return

    def head(t: str) -> None:
        print(f"\n== {t}")

    print(f"Repo: {root}")
    print(f"{len(stories)} stories · {len(tests)} tests · {len(pkgjsons)} packages")

    head("Shared-component package (most stories)")
    for pkg, n in report["ui_package_candidates"]:
        print(f"  {n:>4} stories  {pkg}")
    head("Export barrels")
    for b in report["barrels"] or ["  (none over 2KB found)"]:
        print(f"  {b}")
    head("Token files (css declaring >=5 custom properties)")
    for t in report["token_files"] or []:
        print(f"  {t['count']:>4} tokens  {t['path']}")
        print(f"        e.g. {', '.join(t['sample'][:8])}")
        if t["families"]:
            print(f"        --color-* families: {', '.join(t['families'])}")
    if len(report["token_files"]) > 1:
        print("  ⚠ more than one token file — check whether they must stay in sync")
    head("Stack")
    print("  " + (", ".join(report["stack"]) or "nothing recognised"))
    head("Storybook")
    for c in report["storybook_configs"] or ["  (no .storybook/main.* found)"]:
        print(f"  {c}")
    head("Root scripts worth wiring to <check-cmd>")
    for k, v in report["root_scripts"].items():
        print(f"  {k}: {v}")
    head("Testing convention in the shared package")
    c = report["testing_convention"]
    print(f"  {c['package']}: {c['stories']} stories, {c['tests']} tests → {c['reading']}"
          if c else "  (undetermined)")
    head("Story title roots")
    for t, n in report["story_title_roots"]:
        print(f"  {n:>4}  {t}/…")
    head("Conventions files")
    for f in report["conventions_files"] or ["  (none)"]:
        print(f"  {f}")


if __name__ == "__main__":
    main()

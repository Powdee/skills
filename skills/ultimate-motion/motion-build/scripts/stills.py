"""Render review stills at story times and tile them into one sheet.

Usage: python3 stills.py <film-project> --format landscape|portrait --at=-5,-2,0.5,4,9,12,17 [--width 360]

Story times are converted to frames through src/film/sync.json, so the stills
show exactly what the final film shows at those beats. Writes
build/stills/<format>-<t>.jpg and build/stills/<format>-sheet.jpg.
"""

import argparse
import json
import subprocess
from pathlib import Path

ap = argparse.ArgumentParser()
ap.add_argument("project")
ap.add_argument("--format", default="landscape")
ap.add_argument("--at", required=True)
ap.add_argument("--width", type=int, default=360)
ap.add_argument("--fps", type=int, default=30)
args = ap.parse_args()
P = Path(args.project).resolve()
pairs = json.loads((P / "src/film/sync.json").read_text())["pairs"]


def story_to_playback(s):
    # Invert the (monotone) map by bisection on a piecewise-linear approximation, good enough for stills.
    if s <= pairs[0][1]:
        return pairs[0][0]
    for (p0, s0), (p1, s1) in zip(pairs, pairs[1:]):
        if s0 <= s <= s1:
            return p0 + (p1 - p0) * (s - s0) / (s1 - s0 or 1)
    return pairs[-1][0]


out = P / "build/stills"
out.mkdir(parents=True, exist_ok=True)
subprocess.run(["npx", "remotion", "bundle", "--out-dir", "build/bundle", "--log=error"], cwd=P, check=True)
comp = f"Film-{args.format}"
shots = []
for t in [float(v) for v in args.at.split(",")]:
    frame = max(0, round((story_to_playback(t) - pairs[0][0]) * args.fps))
    f = out / f"{args.format}-{t:g}.jpg"
    subprocess.run(["npx", "remotion", "still", "build/bundle", comp, str(f), f"--frame={frame}", "--image-format=jpeg", "--log=error"], cwd=P, check=True)
    shots.append(f)
inputs = sum((["-i", str(s)] for s in shots), [])
chain = "".join(f"[{i}]scale={args.width}:-2[s{i}];" for i in range(len(shots))) + "".join(f"[s{i}]" for i in range(len(shots))) + f"hstack=inputs={len(shots)}"
sheet = out / f"{args.format}-sheet.jpg"
subprocess.run(["ffmpeg", "-v", "error", "-y", *inputs, "-filter_complex", chain, str(sheet)], check=True)
print(sheet)

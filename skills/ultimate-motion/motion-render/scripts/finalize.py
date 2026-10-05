"""Render the film in each format, set loudness, and make QA contact sheets.

Usage: python3 finalize.py <film-project> --name <file-stem> [--formats landscape,portrait] [--lufs -14] [--crf 17]

Writes <project>/<name>-16x9.mp4 and/or <name>-9x16.mp4. Loudness: one clean
gain to --lufs (−14 for Instagram/TikTok/Shorts, −16 for web embeds) with peaks
kept ≤ −1 dBFS; the picture stream is copied, not re-encoded. Silent films are
left as they are. Contact sheets: build/contact-<format>.jpg (a frame every 2 s).
"""

import argparse
import re
import subprocess
from pathlib import Path

ap = argparse.ArgumentParser()
ap.add_argument("project")
ap.add_argument("--name", required=True)
ap.add_argument("--formats", default="landscape,portrait")
ap.add_argument("--lufs", type=float, default=-14.0)
ap.add_argument("--crf", default="17")
args = ap.parse_args()
P = Path(args.project).resolve()
(P / "out").mkdir(exist_ok=True)
subprocess.run(["npx", "remotion", "bundle", "--out-dir", "build/bundle", "--log=error"], cwd=P, check=True)
suffix = {"landscape": "16x9", "portrait": "9x16"}


def loudness(f):
    r = subprocess.run(["ffmpeg", "-nostats", "-i", str(f), "-vn", "-af", "ebur128=peak=true", "-f", "null", "-"], capture_output=True, text=True).stderr
    i = re.findall(r"I:\s+(-?[\d.]+|-inf) LUFS", r)
    pk = re.findall(r"Peak:\s+(-?[\d.]+|-inf) dBFS", r)
    return (float(i[-1]) if i and i[-1] != "-inf" else None), (float(pk[-1]) if pk and pk[-1] != "-inf" else None)


for fmt in args.formats.split(","):
    raw = P / f"out/{args.name}-{suffix[fmt]}-raw.mp4"
    final = P / f"{args.name}-{suffix[fmt]}.mp4"
    subprocess.run(["npx", "remotion", "render", "build/bundle", f"Film-{fmt}", str(raw), "--codec=h264", f"--crf={args.crf}", "--audio-bitrate=320k", "--log=error"], cwd=P, check=True)
    i, pk = loudness(raw)
    if i is None or i < -60:
        subprocess.run(["cp", str(raw), str(final)], check=True)
        note = "no audio level to set (silent?)"
    else:
        gain = min(args.lufs - i, -1.0 - (pk if pk is not None else -1.0))
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(raw), "-c:v", "copy", "-af", f"volume={gain:.2f}dB", "-c:a", "aac", "-b:a", "320k", "-ar", "48000", "-movflags", "+faststart", str(final)], check=True)
        i2, pk2 = loudness(final)
        note = f"{i:.1f} → {i2:.1f} LUFS, peak {pk2:.1f} dBFS"
    sheet = P / f"build/contact-{fmt}.jpg"
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(final), "-vf", "fps=1/2,scale=240:-2,tile=8x4", "-frames:v", "1", str(sheet)], check=True)
    dur = float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(final)], capture_output=True, text=True).stdout)
    print(f"{fmt}: {final} ({dur:.1f} s) · {note} · sheet {sheet}")

#!/usr/bin/env python3
"""Find the spoken phrases in a voice-over recording: one row per stretch of speech between pauses.

    python3 segments.py voice.mp3 [--threshold -38] [--min-gap 0.18] [--json]

Decodes with ffmpeg ($FFMPEG or ffmpeg on PATH) to 16 kHz mono, builds a 20 ms peak envelope and
splits on pauses of at least --min-gap seconds quieter than --threshold dB below the loudest peak.
TTS voices pause 0.2–0.4 s at full stops and "…", rarely at commas, so expect one segment per
sentence or clause. Map segments to script phrases by length (≈4.5 syllables per second for Czech,
≈2.5 words per second for English) and their order. Stdlib only.
"""
import argparse
import array
import json
import math
import os
import subprocess
import sys

parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
parser.add_argument("audio")
parser.add_argument("--threshold", type=float, default=-38.0, help="speech threshold in dB below the peak")
parser.add_argument("--min-gap", type=float, default=0.18, help="shortest pause that splits two segments (s)")
parser.add_argument("--json", action="store_true")
args = parser.parse_args()

ffmpeg = os.environ.get("FFMPEG", "ffmpeg")
raw = subprocess.run([ffmpeg, "-v", "error", "-i", args.audio, "-ac", "1", "-ar", "16000", "-f", "s16le", "-"],
                     check=True, capture_output=True).stdout
samples = array.array("h", raw)
rate, step = 16000, 0.02
window = int(rate * step)
envelope = [max((abs(v) for v in samples[i:i + window]), default=0) for i in range(0, len(samples), window)]
peak = max(envelope) or 1
speech = [20 * math.log10(max(value, 1) / peak) > args.threshold for value in envelope]

segments, start, silent = [], None, 0
for index, voiced in enumerate(speech):
    t = index * step
    if voiced:
        if start is None:
            start = t
        silent = 0
    elif start is not None:
        silent += 1
        if silent * step >= args.min_gap:
            segments.append((round(start, 2), round(t - silent * step + step, 2)))
            start, silent = None, 0
if start is not None:
    segments.append((round(start, 2), round(len(speech) * step, 2)))

duration = len(samples) / rate
if args.json:
    json.dump({"duration": round(duration, 3), "segments": [{"start": s, "end": e} for s, e in segments]}, sys.stdout, indent=1)
    print()
else:
    print(f"duration {duration:.2f} s, {len(segments)} segments")
    previous = 0.0
    for number, (s, e) in enumerate(segments, 1):
        print(f"{number:3d}  {s:6.2f} – {e:6.2f}   length {e - s:5.2f}   pause before {s - previous:4.2f}")
        previous = e

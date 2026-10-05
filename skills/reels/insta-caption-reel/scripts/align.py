#!/usr/bin/env python3
"""Word timings for a supplied voice-over.

  python3 align.py <voice.mp3> --script "<text with [tags]>" [--lang en] [--out words.json] [--check]

Runs whisper-cli with DTW token timestamps (flash attention off, which DTW needs) and ffmpeg
silencedetect, then gives every script word a start time:
  - the first word of a speech region starts at that region's start (DTW lags 0.2–0.35 s there);
  - other words start at DTW − 0.22 s, kept inside their region and in order.
Regions with no words are printed as non-speech (laugh, clap, breath) – a clap is a shake cue.
--check transcribes each region on its own, to confirm what is said where.

Writes {"speech_end", "silences", "regions", "words": [[text, start], ...]}.
"""
import argparse
import difflib
import json
import os
import re
import subprocess
import sys
import tempfile

MODEL = os.path.expanduser("~/.cache/whisper-cpp/ggml-large-v3-turbo.bin")
LAG = 0.22            # DTW lag inside a region
SNAP = 0.45           # first word within this of a region start snaps to it


def norm(s):
    return re.sub(r"[^0-9a-zà-ž]", "", s.lower().replace("’", "'"))


def script_words(text):
    text = re.sub(r"\[[^\]]*\]", " ", text)          # ElevenLabs tags: [laughs], [claps] …
    text = text.replace("—", " ").replace("–", " ").replace("…", " ")
    out = []
    for w in text.split():
        w = w.strip(".,!:;\"“”")
        if norm(w):
            out.append(w)
    return out


def silences(wav):
    log = subprocess.run(["ffmpeg", "-hide_banner", "-i", wav, "-af", "silencedetect=noise=-38dB:d=0.1",
                          "-f", "null", "-"], capture_output=True, text=True).stderr
    starts = [float(x) for x in re.findall(r"silence_start: ([0-9.]+)", log)]
    ends = [float(x) for x in re.findall(r"silence_end: ([0-9.]+)", log)]
    dur = float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", wav],
                               capture_output=True, text=True).stdout)
    if len(ends) < len(starts):
        ends.append(dur)
    return list(zip(starts, ends)), dur


def whisper_words(wav, lang, prompt, tmp):
    base = os.path.join(tmp, "dtw")
    subprocess.run(["whisper-cli", "-m", MODEL, "-f", wav, "-l", lang, "-t", "8", "-nfa",
                    "-dtw", "large.v3.turbo", "-ojf", "-of", base, "--prompt", prompt],
                   capture_output=True, check=True)
    data = json.load(open(base + ".json"))
    words = []
    for seg in data["transcription"]:
        for tok in seg["tokens"]:
            t = tok["text"]
            if t.startswith("[_"):
                continue
            if t.startswith(" ") or not words:
                words.append({"text": t.strip(), "dtw": tok["t_dtw"] / 100})
            elif any(c.isalnum() for c in t):
                words[-1]["text"] += t
    return [w for w in words if norm(w["text"])]


def transcribe(wav, a, b, lang, tmp):
    seg = os.path.join(tmp, "seg.wav")
    subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-i", wav, "-af",
                    f"atrim={a}:{b},asetpts=PTS-STARTPTS,apad=pad_dur=1", seg], check=True)
    r = subprocess.run(["whisper-cli", "-m", MODEL, "-f", seg, "-l", lang, "-t", "8", "-nt"],
                       capture_output=True, text=True)
    return " ".join(r.stdout.split())


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("voice")
    ap.add_argument("--script", required=True, help="the voice-over text, ElevenLabs [tags] allowed")
    ap.add_argument("--lang", default="en")
    ap.add_argument("--out", default="words.json")
    ap.add_argument("--check", action="store_true", help="transcribe every speech region separately")
    args = ap.parse_args()

    tmp = tempfile.mkdtemp()
    wav = os.path.join(tmp, "voice16.wav")
    subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-i", args.voice, "-ar", "16000", "-ac", "1", wav],
                   check=True)
    sil, dur = silences(wav)
    regions, t = [], 0.0
    for a, b in sil:
        if a - t > 0.05:
            regions.append([round(t, 3), round(a, 3)])
        t = b
    if dur - t > 0.05:
        regions.append([round(t, 3), round(dur, 3)])
    speech_end = regions[-1][1] if regions else dur

    script = script_words(args.script)
    heard = whisper_words(wav, args.lang, re.sub(r"\[[^\]]*\]", "", args.script), tmp)

    # Map script words onto whisper words in order; unmatched script words get interpolated.
    sm = difflib.SequenceMatcher(a=[norm(w) for w in script], b=[norm(w["text"]) for w in heard], autojunk=False)
    dtw = [None] * len(script)
    for blk in sm.get_matching_blocks():
        for k in range(blk.size):
            dtw[blk.a + k] = heard[blk.b + k]["dtw"]
    known = [i for i, v in enumerate(dtw) if v is not None]
    if not known:
        sys.exit("whisper heard none of the script words – check --lang and the script")
    for i in range(len(dtw)):
        if dtw[i] is None:
            prev = max([k for k in known if k < i], default=None)
            nxt = min([k for k in known if k > i], default=None)
            if prev is None:
                dtw[i] = dtw[nxt] - 0.25 * (nxt - i)
            elif nxt is None:
                dtw[i] = dtw[prev] + 0.25 * (i - prev)
            else:
                dtw[i] = dtw[prev] + (dtw[nxt] - dtw[prev]) * (i - prev) / (nxt - prev)

    def region_of(t):
        idx = 0
        for j, (a, _) in enumerate(regions):
            if a <= t + 0.1:
                idx = j
        return idx

    words, used = [], set()
    prev_start = -1.0
    for i, w in enumerate(script):
        r = region_of(dtw[i])
        a, b = regions[r]
        if r not in used and dtw[i] - a <= SNAP:
            start = a
        else:
            start = min(max(dtw[i] - LAG, a), b - 0.05)
        start = max(start, prev_start + 0.06)
        used.add(r)
        prev_start = start
        words.append([w, round(start, 2)])

    print(f"speech regions (voice {dur:.2f}s, speech ends {speech_end:.2f}s):")
    for j, (a, b) in enumerate(regions):
        inside = [w for w, s in words if a - 0.01 <= s < b]
        label = " ".join(inside) if inside else "— non-speech (laugh / clap / breath?)"
        line = f"  {a:6.2f}–{b:6.2f}  {label}"
        if args.check:
            line += f"\n                  whisper: {transcribe(wav, a, b, args.lang, tmp)}"
        print(line)
    unmatched = [script[i] for i in range(len(script)) if i not in {blk.a + k for blk in sm.get_matching_blocks() for k in range(blk.size)}]
    if unmatched:
        print("interpolated (whisper heard them differently):", " ".join(unmatched))

    json.dump({"voice": os.path.abspath(args.voice), "speech_end": round(speech_end, 2),
               "silences": [[round(a, 3), round(b, 3)] for a, b in sil], "regions": regions, "words": words},
              open(args.out, "w"), ensure_ascii=False, indent=1)
    print(f"wrote {args.out}: {len(words)} words")


if __name__ == "__main__":
    main()

"""Sync the film to a voice-over the user recorded / generated (e.g. ElevenLabs).

Usage:
  python3 voice_sync.py <film-project> --voice <file.mp3|wav> [--music <file>] [--lang sk] [--tail 3]
  python3 voice_sync.py <film-project> --no-voice [--music <file>]      # story's own pacing

Reads src/film/beats.json: [{ "story": <story seconds>, "say": "<words that start that beat>" }, ...]
(motion-script writes it; each beat is the moment a line starts and the story time
the picture should be at then). Transcribes the voice with whisper (word timings),
finds each beat's words, and writes src/film/sync.json:
  pairs   [[voice seconds, story seconds], ...]   — the film eases between pairs
  voice   public path of the cleaned voice (-16 LUFS)
  music   public path of the music bed, if given
  speech  voice activity regions (music ducks under them)
Also prints a table: beat, where it was found, and how sure the match is.
"""

import argparse
import difflib
import json
import os
import re
import shutil
import subprocess
import unicodedata
import wave
from pathlib import Path

import numpy as np

ap = argparse.ArgumentParser()
ap.add_argument("project")
ap.add_argument("--voice")
ap.add_argument("--no-voice", action="store_true")
ap.add_argument("--music")
ap.add_argument("--lang", default=None)
ap.add_argument("--tail", type=float, default=3.0, help="seconds the end card holds after the voice ends")
ap.add_argument("--model", default=os.path.expanduser("~/.cache/whisper-cpp/ggml-large-v3-turbo.bin"))
args = ap.parse_args()

P = Path(args.project).resolve()
film = P / "src/film"
beats_doc = json.loads((film / "beats.json").read_text())
beats = beats_doc["beats"]
lang = args.lang or beats_doc.get("language", "auto")
story_src = (film / "story.ts").read_text()
START = float(re.search(r"export const START = (-?[\d.]+)", story_src).group(1))
END = float(re.search(r"export const END = (-?[\d.]+)", story_src).group(1))
audio_dir = P / "public/audio"
audio_dir.mkdir(parents=True, exist_ok=True)
out = {"pairs": [[START, START], [END, END]], "voice": None, "music": None, "speech": []}

if args.music:
    ext = Path(args.music).suffix
    shutil.copy2(args.music, audio_dir / f"music{ext}")
    out["music"] = f"audio/music{ext}"

if args.voice and not args.no_voice:
    voice = audio_dir / "voice.wav"
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", args.voice, "-af", "loudnorm=I=-16:TP=-1.5:LRA=11", "-ar", "48000", "-ac", "1", str(voice)], check=True)
    out["voice"] = "audio/voice.wav"
    w16 = P / "build/voice16k.wav"
    w16.parent.mkdir(exist_ok=True)
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(voice), "-ar", "16000", "-ac", "1", str(w16)], check=True)
    duration = float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(voice)], capture_output=True, text=True).stdout)

    # Word timings.
    prompt = " ".join(b["say"] for b in beats)[:800]
    subprocess.run(["whisper-cli", "-m", args.model, "-f", str(w16), "-l", lang, "-t", "8", "-ml", "1", "-sow", "-ojf", "-of", str(P / "build/voice_words"),
                    "--dtw", "large.v3.turbo", "--prompt", prompt], capture_output=True, check=True)
    data = json.loads((P / "build/voice_words.json").read_text())
    words = [(s["offsets"]["from"] / 1000, s["text"].strip()) for s in data["transcription"] if s["text"].strip()]

    def norm(s):
        s = unicodedata.normalize("NFD", s.lower())
        s = "".join(ch for ch in s if unicodedata.category(ch) != "Mn")
        return re.sub(r"[^\w\s]", "", s)

    tokens = [norm(w) for _, w in words]
    times = [t for t, _ in words]
    pairs, cursor = [], 0
    print(f"{'story':>7}  {'voice':>7}  match  beat")
    for b in beats:
        target = norm(b["say"]).split()
        n = max(1, min(len(target), 4))
        best, best_i = 0.0, None
        for i in range(cursor, len(tokens)):
            window = " ".join(tokens[i:i + len(target)])
            score = difflib.SequenceMatcher(None, " ".join(target), window).ratio()
            head = difflib.SequenceMatcher(None, " ".join(target[:n]), " ".join(tokens[i:i + n])).ratio()
            score = 0.5 * score + 0.5 * head
            if score > best:
                best, best_i = score, i
        if best_i is None or best < 0.45:
            print(f"{b['story']:7.2f}  {'—':>7}  {best:4.2f}   {b['say']}   (not found — check the line or the beat)")
            continue
        vt = times[best_i]
        if pairs and (vt <= pairs[-1][0] or b["story"] <= pairs[-1][1]):
            print(f"{b['story']:7.2f}  {vt:7.2f}  {best:4.2f}   {b['say']}   (out of order — skipped)")
            continue
        pairs.append([round(vt, 3), b["story"]])
        cursor = best_i + 1
        print(f"{b['story']:7.2f}  {vt:7.2f}  {best:4.2f}   {b['say']}")
    # Anchor both ends: voice 0 → START (or the first beat), voice end + tail → END.
    if not pairs or pairs[0][0] > 0.05:
        first_story = pairs[0][1] if pairs else START
        pairs.insert(0, [0.0, min(START, first_story)])
    last_t = max(duration + args.tail, pairs[-1][0] + 0.5)
    if pairs[-1][1] < END:
        pairs.append([round(last_t, 3), END])
    out["pairs"] = pairs

    # Voice activity, for ducking the music.
    wv = wave.open(str(w16))
    x = np.frombuffer(wv.readframes(wv.getnframes()), np.int16).astype(np.float32) / 32768
    hop = 160
    db = 20 * np.log10(np.sqrt((x[: len(x) // hop * hop].reshape(-1, hop) ** 2).mean(1)) + 1e-9)
    on = db > np.percentile(db, 10) + 18
    regions, i = [], 0
    while i < len(on):
        if on[i]:
            j = i
            while j < len(on) and on[j]:
                j += 1
            if regions and i - regions[-1][1] < 35:
                regions[-1][1] = j
            else:
                regions.append([i, j])
            i = j
        else:
            i += 1
    out["speech"] = [[round(a / 100, 2), round(b / 100, 2)] for a, b in regions if b - a > 15]
    print(f"\nvoice {duration:.1f} s → film {out['pairs'][-1][0]:.1f} s; {len(out['pairs'])} sync points")

(film / "sync.json").write_text(json.dumps(out, indent=1))
print(f"→ {film / 'sync.json'}")

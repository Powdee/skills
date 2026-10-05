---
name: insta-caption-reel
description: Turns your camera clips plus a voice-over you supply (usually an ElevenLabs export, delivered later) into an Instagram reel with signature kinetic captions. Big uppercase words pop in on the voice in Hellix italic, Bodoni italic and stencil faces, coloured #f4f4f4 / #032028, with font cycling on key beats, punch-in zooms and a clap shake. Renders vertical 1080×1920 for the phone (or 16:9) with the camera audio muted. Use when the user says /insta-caption-reel, or asks to caption a reel or talking-head video "in this style", add the storyboard captions to a new video, or make another version of the Revitamal "this is me" reel.
---

# Insta caption reel

Every reel gets exactly the same caption look. Before writing captions:

- read `references/style.md`;
- look at `references/storyboard.jpg`, the original storyboard the style was made from (style.md explains how to read it).

`examples/revitamal-us-vertical.json` is the finished reference reel. The voice drives the timing, and the engine (`scripts/reel.py`) does the layout, animation, camera and audio.

**Needs:** ffmpeg, `whisper-cli` with `~/.cache/whisper-cpp/ggml-large-v3-turbo.bin` (`brew install whisper-cpp`), and `python3` with Pillow. Libre Bodoni and Big Shoulders Stencil are bundled in `fonts/` (OFL). **Hellix is commercial and not bundled**: put your licensed `Hellix-Bold.ttf` in `fonts/`; see `fonts/README.md`.

## 1. Collect

- **Clips:** one or more videos, in story order. Look at each one with a contact sheet (`ffmpeg … -vf fps=1,scale=480:-1,tile=…`). Note:
  - what happens in it;
  - the **face point** in source pixels (centre of the face);
  - the **head top** y.
- **Script:** the voice-over text, ElevenLabs tags like `[laughs]` or `[claps]` included.
- **Voice:** the user supplies it, often after the clips. Never generate or replace it. If it hasn't arrived, do steps 1 and 4 (clip plan), say what you're waiting for and stop.
- **Format:** vertical (phone) unless the user asks for 16:9. Camera audio is muted unless the user asks to keep it (`"keep_video_audio": true`).

Work in `reels/<slug>/` under the current directory. That folder holds `reel.json`, `words.json`, `base.mp4` and `qa.jpg`. The final MP4 goes to `~/Downloads/<slug>.mp4` unless the user says otherwise.

## 2. Time the words

```sh
python3 <skill-dir>/scripts/align.py <voice.mp3> --script "<script>" --lang en --out reels/<slug>/words.json --check
```

It prints every speech region with the words it placed there, plus what whisper hears in that region alone (`--check`).

- **Non-speech regions:** a short one near a `[claps]` tag is the clap; use it for `shakes`.
- **Interpolated words** were heard differently. Look at their region, and fix them in `words.json` by hand if needed.
- **Speech end + 2 s** is the film length.

## 3. Write reel.json

Start from `examples/revitamal-us-vertical.json`.

- `clips`:
  - `[{src, in, out, face}]` in story order;
  - the last clip omits `out` and fills the film;
  - cut between clips inside a voice pause before a new thought;
  - `speed` < 1 only as a last resort (see style.md).
- `captions`:
  - one entry per phrase, covering every word of `words.json` in order;
  - lines look like `"right | I’M:HI150L BUILDING:HI150D"`, where each token is `TEXT:FACE SIZE COLOUR` written as one word;
  - FACE is `HI`, `SI`, `ST` or `HU`, and COLOUR is `L` (#f4f4f4) or `D` (#032028);
  - lines stack upward from the bottom of the caption zone;
  - optional keys:
    - `"end"`: seconds, or `"cut"` to end with the shot;
    - `"alts"` + `"cycle": {"after", "step", "seq"}`: font cycling.
- `punches`: `[from, to|null, zoom]` hard punch-ins on hero beats; `null` holds to the end.
- `shakes`: clap times.
- `output`: the final MP4 path.
- `layout` (optional): overrides such as `{"bottom": …}`, when the head sits higher or lower than in the example.

## 4. Check, look, render

```sh
python3 <skill-dir>/scripts/reel.py check  reels/<slug>/reel.json   # words match the voice, no overlaps
python3 <skill-dir>/scripts/reel.py qa     reels/<slug>/reel.json   # builds base.mp4, writes qa.jpg
python3 <skill-dir>/scripts/reel.py render reels/<slug>/reel.json   # final MP4 + loudness
```

Open `qa.jpg` and look at it before rendering. It has one tile per caption plus every font-cycle step, and red boxes for the Reels UI zones. Fix these problems:

- `L` text over white curtains or the laptop: switch the word to `D` or move the caption;
- text touching the head at a punch-in: lower the punch or raise `layout.bottom`;
- the same face or alignment on consecutive hero words;
- anything inside the red zones.

`reel.py still <json> <t>` renders a single frame.

## 5. Report

Give the user:

- the path, format, length and loudness;
- where you cut between clips and why;
- any place the captions differ from the script or storyboard, and why (for example, the voice says something else).

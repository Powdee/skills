---
name: motion-render
description: Stage 5 of the ultimate-motion film pipeline. Renders a motion-graphics film in 16:9 and 9:16 with Remotion, sets loudness with one clean gain (−14 LUFS for Instagram/TikTok/Shorts, −16 for web embeds, peaks ≤ −1 dBFS), makes QA contact sheets and reports the deliverables. Use to render or re-render an animated explainer/teaser/intro/outro, fix its loudness, or when /ultimate-motion calls it.
---

# Motion render

```sh
.venv/bin/python <skill-dir>/scripts/finalize.py <film-project> --name <file-stem> \
  [--formats landscape,portrait] [--lufs -14]
```

This writes `<name>-16x9.mp4` and `<name>-9x16.mp4` in the project root. A 30–60 s film takes about a minute on Apple Silicon.

- Use `--lufs -16` for a landing page embed.
- For an embed that should loop or autoplay silently, also export a version without the voice: set `voice` to `null` in `sync.json` and keep the pairs.

## QA before calling it done

Open `build/contact-*.jpg` and check:

- the intro reads in the first 2 s;
- every beat shows its change;
- the 9:16 version frames one readable panel at a time;
- the end card holds;
- there are no blank or black frames.

Confirm the printed loudness and duration.

## Report

Give the user:
- absolute paths of the files and how to open the folder (`! open <dir>`);
- formats, lengths and loudness;
- which on-screen data is illustrative;
- what still needs them, e.g. licences for music.

Keep it short and in their language.

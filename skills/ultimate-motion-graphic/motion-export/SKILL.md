---
name: motion-export
description: "Export a code-built motion graphic (<motion-graphic>) to an MP4: frame-exact 1080p or 4K at 30/60 fps with its soundtrack, rendered frame by frame so it never stutters. Use whenever someone asks to download, render, export or save the animation, explainer or product video as a file (for social, sales decks, YouTube, email, events), or needs variants such as voice-only vs music-and-effects, or one file per language."
---

# /motion-export — the motion as a video file

A screen recording of an animation drops frames whenever the machine hiccups. Because a
`<motion-graphic>` can draw any moment on request, this skill renders it instead: it asks the
element for each frame at the exact time, steps the page's CSS loops (caret, ring, shimmer) to
the same clock, screenshots it at the output resolution, and pipes the frames into ffmpeg with
the soundtrack. Slow capture just takes longer; the file is identical.

## STEP 1 — Agree on the variants

Ask before rendering — each render takes ~1–2 minutes per minute of video:

- **Which cut:** full mix (voice + music + effects), voice only, or music + effects only.
- **Which languages:** one file per locale page.
- **Format:** 1920×1080 @ 30 fps is the default; 60 fps for smoother camera moves (twice the
  render time); `--width 3840` for 4K; the stage's aspect ratio is kept.
- **Where to save** and how to name the files (e.g. `<Product> - How it works (cs).mp4`).

## STEP 2 — Render

The page with the motion must be running (dev server or a deployed URL).

```bash
eval "$(bash <skill-dir>/scripts/setup-tools.sh)"     # once: Playwright + ffmpeg in a shared cache
node <skill-dir>/scripts/render.cjs --url http://localhost:4321/ \
  --open "[data-how-it-works]" \              # the button that opens the player, if any
  --out "~/Desktop/Product - How it works.mp4" \
  [--fps 30] [--width 1920] [--audio soundtrack.mp3 | --audio none] [--from 0 --to 12]
```

- Without `--audio`, the element's own `<audio src>` is used (the web mix). For a voice-only cut,
  pass the voice recording itself; for a silent file, `--audio none`.
- `--from/--to` are playback seconds — handy for a quick 2-second test render before the full one.
- The script pins the stage over the page at its design size, hides the player chrome and decodes
  images first, so overlays, cookie banners and lazy images do not leak into frames. If the page
  shows something on top anyway (a chat widget), hide it before rendering.

## STEP 3 — Verify

Check the file instead of assuming:

```bash
$FFMPEG -hide_banner -i out.mp4 2>&1 | grep -E "Duration|Video|Audio"      # 1920x1080, yuv420p(tv), fps, audio stream
for t in 1 10 25 40; do $FFMPEG -v error -y -ss $t -i out.mp4 -frames:v 1 -vf scale=640:-1 check-$t.png; done
$FFMPEG -hide_banner -i out.mp4 -vn -af volumedetect -f null - 2>&1 | grep -E "mean|max"
```

Open the frames with the Read tool and compare them with the storyboard beats; confirm the
duration equals the motion's length and the audio levels match the mixed track. Then tell the
person exactly what was produced (resolution, fps, length, size, which audio) and where.

## Notes

- Colour: screenshots are full-range JPEG; the script converts to TV range (`yuv420p(tv)`) so
  players do not show washed-out colours.
- Pages with looping background videos never reach network idle; the script waits for `load`.
- Large files: ~15 MB per minute at 1080p30 with this encoder setting (`-crf 17 -preset slow`).
- If people will watch it muted (social autoplay), the hook must work without sound — check the
  first 5 seconds silently.

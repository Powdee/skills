---
name: motion-build
description: Stage 3 of the ultimate-motion film pipeline. Builds a motion-graphics product film in a deterministic Remotion stage engine. It recreates the real product UI as animated HTML/CSS (data-in/out timings, typed text, counted numbers, re-sorting rows, drawing charts), adds title-card intro and logo end card, directs a camera between named targets and a cursor with clicks, and supports 16:9 and 9:16. Use when animating a product UI, building an explainer/teaser/intro/outro, changing what happens on screen or when, or when /ultimate-motion calls it.
---

# Motion build

## 1. Scaffold

```sh
<skill-dir>/scripts/new_film.sh <film-project>
```

This copies `template/` (engine + a complete example film), runs `npm install`, makes `.venv` (numpy for the audio scripts) and type-checks. Open `npm run dev` (Studio on :3300) to scrub the example: it uses every primitive, so read it before writing your own. The engine API is in `references/engine.md`; read it.

## 2. Where things go

- `src/film/copy.ts`: every on-screen string and the example data. Take wording and data from the product (`brief.md`).
- `src/film/Scene.tsx`:
  - `World` is the product workspace on a 1280×720 stage. Recreate the real screens: layout, panels, rows, KPIs, charts, assistant.
  - `Overlay` holds the title cards, end card and notices.
- `src/film/film.css`: the product's look. Copy its tokens (colours, radii, type sizes, shadows) from the codebase, so the film looks like the app. Keep the product UI on its own `ui-` classes.
- `src/film/story.ts`:
  - `START`/`END` of story time;
  - camera shots, plus `portraitCamera` for 9:16;
  - cursor moves, visibility windows, clicks;
  - fonts and the sound-effect cues.
- `src/engine/`: the runtime (`Stage`, `Soundtrack`, `fx.css`). Change it only to add a general primitive, and add it to the template too.

## 3. Build it beat by beat, from the beat sheet

For each beat in `beats.json` / `script.md`:

1. Lay out the elements it needs in `World` (once, statically).
2. Give them timings:
   - `data-in="start dur ease"` / `data-out`, plus an `fx-*` class for the motion;
   - `data-type` for typed text, `data-count` for numbers, `data-slot` for re-ordering;
   - `data-pulse` for presses, and `fx-draw` on SVG paths with `pathLength="1"`.
3. If the camera or cursor visits an element, give it `data-focus="name"` and add the shot, cursor move and click in `story.ts`.
4. Add sound cues in `story.ts` (`AUDIO.cues`) for typing, counts, chart draws and pops. Clicks get their sound automatically.

Rules that keep it working:

- **Everything from story time.** No CSS `animation`/`transition`, `Date`, `Math.random` or `setTimeout`. For loops, use `--t`, `--spin`, `--shimmer`, `--caret` and the `fx-caret`/`fx-shimmer`/`fx-spin-border` helpers.
- **Static markup.** Don't change JSX per frame. The runtime animates through attributes and CSS variables.
- **Images** through Remotion's `<Img>` (waits for load), stored in `public/`.
- **Fonts:** `FONT_FILES` in `story.ts` for brand woff2 files.
- **Names:** never name a file `film.ts` next to `Film.tsx`; macOS treats them as the same file.

## 4. Look at it, in both formats

```sh
.venv/bin/python <skill-dir>/scripts/stills.py <film-project> --format landscape --at=-5,-2,0.5,4,8,10,12.5,17
.venv/bin/python <skill-dir>/scripts/stills.py <film-project> --format portrait --at=-5,-2,0.5,4,8,10,12.5,17
```

Pick times inside each beat. Check:

- text is legible at the shot's zoom (in 9:16, frame one panel at a time via `portraitCamera`);
- nothing is clipped or overflowing, and nothing still animating at a "held" moment;
- the end card lands, and the intro title fits on two lines.

**Checkpoint:** show the user the two sheets.

Hand back to `ultimate-motion` (next: `motion-audio`).

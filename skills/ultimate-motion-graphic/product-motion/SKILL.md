---
name: product-motion
description: "Make an interactive product motion graphic: a 'how it works' video built in code from the product's real UI. It has a title-card hook, a one-shot camera through the product, pointer clicks, typing, AI answers, charts and an end card, with chapters, pause/scrub and reduced-motion support, optionally voiced and exported to MP4. Use whenever someone wants a product explainer, demo or walkthrough video, an animated product tour, an animated hero or landing showcase of the app, or to replace a recorded screen video with something sharper — even if they only say 'show how the product works' or 'make a video of the dashboard'. Starts with product-brief, then hands sound to motion-soundtrack and video files to motion-export."
---

# /product-motion — a product explainer built from the product itself

A screen recording is frozen the moment it is made: blurry when scaled, wrong after the next UI
change, impossible to translate, out of sync with any narration. This skill builds the explainer
as code instead — the product's UI rebuilt as static markup on a 1280×720 stage, animated by a
small deterministic engine (`assets/engine/motion-engine.js`). Every frame is a pure function of
time, which buys you everything else for free: crisp at any size, scrub by chapter, reduced
motion, per-language copy, a voice-over that drives the timing, and frame-exact MP4 export.

## The flow

Each stage ends with the person deciding. The gates sit before the expensive step: a redirected
storyboard costs one message; a redirected build costs hours.

```
0 Brief → 1 Story ▸gate → 2 Build → 3 Review ▸gate → 4 Sound (motion-soundtrack) → 5 Export (motion-export)
```

## STAGE 0 — Brief

Read `.claude/product-brief.md`. If it is missing, run the **product-brief** skill first. You need
the flows worth showing, the product's own words, the brand kit and the demo-data findings before
you can storyboard anything honest.

## STAGE 1 — Story (gate)

Write a storyboard and get it approved before writing any markup. Read
`references/storytelling.md` for the structure, timing budgets and copy rules. In short:

- **Shape:** hook (title cards: the pain → the turn) → a question asked in the product → the
  product answers by doing (rank, open, show evidence) → explain (assistant/AI answer) → decide
  (compare options) → plan (the outcome) → end card (logo + one line).
- **40–60 s, 5–7 chapters, one idea per beat.** The camera tells the viewer where to look; the
  pointer only clicks what a user would click.
- **Use the product's own words.** No captions explaining the UI. On-screen copy is the UI's own
  copy; title and end cards are the only added text, and only if the person wants them.
- **Demo data:** apply the brief's findings — internal names instead of real entities, an
  "illustrative data" notice, attribution on third-party imagery.

Present it as a table and stop for approval:

| t (s) | Chapter | Beat | On screen | Camera | Pointer | VO line (optional) |
|---|---|---|---|---|---|---|

## STAGE 2 — Build

1. **Copy the engine** into the project: `assets/engine/motion-engine.js` and
   `motion-engine.css` (no dependencies; plain ES module + CSS). Start from
   `assets/template/index.html` — a complete, working 11-second piece that already shows a title
   card, a typed question, the pull-back into the product, sorting rows, a click, count-ups, a
   push-in and an end card. Serve it (`python3 -m http.server`) to see it run.
2. **Rebuild the screens as static markup** inside `.mg-world` at design pixels (1280×720 by
   default). Copy structure and tokens from the real components, but do not embed the live app:
   the world must render identically every time. Keep world text ≥ 11 px; zoomed shots make
   small UI readable.
3. **Time everything in the markup** with `data-in` / `data-out` / `data-pulse` / `data-type` /
   `data-count` / `data-slot` / `data-scroll`, and put camera shots, pointer moves, chapters and
   storyboard-level sound cues in the storyboard JSON. Name what the camera and pointer target
   with `data-focus`. The full contract is in `references/engine.md`.
4. **Use the recipes** in `references/techniques.md` — each is a pattern that already worked:
   one-shot pull-back from an input, list re-sorting, streamed AI answers, carousels, SVG draws
   and wipes, bars, schedules that pop column by column, scrolling panels, end cards, notices.
5. **Integrate** (modal player, Astro, React/Next, plain HTML, localisation, server headers):
   `references/integration.md`.

## STAGE 3 — Review (gate)

```bash
eval "$(bash <skill-dir>/scripts/setup-tools.sh)"     # once: Playwright + ffmpeg in a shared cache
node <skill-dir>/scripts/frames.cjs --url <page> [--open "<button that opens the player>"] \
  --times <one time per beat, e.g. -4,0.8,3.6,7,12.5,20,31> --out .claude/motion-frames
node <skill-dir>/scripts/pacing.cjs --url <page> [--open "…"]
```

Open the frames with the Read tool and check each beat against the storyboard:

- text fits in every locale (render each locale's page), nothing overflows its panel;
- the pointer lands on its target and the ripple is where the click is;
- the camera frames the subject — no half-cut headers, no empty band below a bottom-anchored
  element (offset the shot with `ay`);
- every chapter start and settle frame looks intentional (people will scrub to them);
- reduced motion opens on a settled frame; mobile width stays legible.

`pacing.cjs` should report p99 ≈ 16.7 ms. One long frame on a cold run is usually image decoding
or a background video elsewhere on the page — run it twice before chasing it.

Show the person a contact sheet of the key frames and collect changes. Iterate on the frames
before moving to sound: re-timing after a voice-over is recorded means re-recording or re-syncing.

## STAGE 4 — Sound

Hand off to **motion-soundtrack**: voice-over script for ElevenLabs, sync to the recording, music
ducked under the voice, sound effects on the actions that cause them, one mixed track for the web.

## STAGE 5 — Export

Hand off to **motion-export** for MP4 files (voice-only and full mix, per language).

## What people pushed back on

These came from real reviews of a finished piece. Treat them as defaults, not laws:

- **Simple beats clever.** One action per beat, generous holds, no explanatory captions.
- **Hooks work when they name a pain the audience owns** ("Investment plan? `final_v7.xlsx`" with
  the version number counting up) and then turn ("There's a better way").
- **Don't push the camera into photos or imagery unless asked.** Zoom into UI to make it
  readable; leave evidence images at the size the product shows them.
- **Real recorded sounds, not synthesized ones.** Generated clicks and whooshes sounded cheap.
- **Fake claims about real things are a liability.** Anonymize; label illustrative data; credit
  imagery on the image itself, where it appears.
- **End cards stay clean:** logo and one line. Credits belong next to the asset they credit.
- **Let the voice-over drive the timing** (motion-soundtrack's sync), instead of re-timing the
  animation by hand to a recording.

## When things look wrong

- Element invisible: an element with only `data-out` counts as already in; an element with
  `data-in` starts invisible until its time.
- Selector collisions: a broad rule like `.kpi span` also hits a counter `<span data-count>`
  inside it — scope label styles with `>`.
- Rows overlapping while sorting: give rows an opaque background and the moving row a z-index.
- Text input grows to two lines when typing a long question — expected; clear typed text after
  send with the third `data-type` value so it collapses back.
- A capture script never starts: pages with looping background video never reach
  "networkidle"; the scripts wait for `load`.

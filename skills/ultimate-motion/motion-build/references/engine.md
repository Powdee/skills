# Stage engine reference

Contents:
1. Clocks
2. Timing attributes
3. fx classes
4. Camera and cursor
5. Title cards
6. Sound cues
7. Formats

## 1. Clocks

- **Story time** (seconds) is the film's own clock. All animation timings are in story time; negative values hold the intro.
- **Playback time** is the voice-over's clock. `src/film/sync.json` → `pairs: [[playback, story], …]` maps one onto the other with a smooth monotone curve.
- Without a voice the pairs are `[[START, START], [END, END]]`, so story time is playback time.
- The composition runs from the first to the last pair. Its duration comes from `sync.json`, so it changes when the voice is synced.

## 2. Timing attributes (on any element inside `<Stage>`)

| Attribute | Value | Effect |
|---|---|---|
| `data-in` | `"start dur ease"` | `--p` 0→1 (opacity follows) |
| `data-out` | `"start dur ease"` | `--o` 0→1 (fades out; with no `data-in` the element starts visible) |
| `data-pulse` | `"start dur"` | `--k` 0→1→0 (press, highlight) |
| `data-slot` | `"from to start dur ease"` | `--slot` (e.g. `top: calc(var(--slot) * 44px)` to re-sort rows) |
| `data-type` + `data-text` | `"start end [clear]"` | types the text with human rhythm; empties at `clear` |
| `data-count` + `data-value` [`data-from`, `data-decimals`] | `"start dur ease"` | counts a number (locale formatting) |
| `data-scroll` | `"start dur ease"` | scrolls the element to its end |
| `data-focus` | `"name"` | camera / cursor target |

Eases: `l` linear, `o` out (default), `io` in-out, `b` slight overshoot (pops). Default duration is 0.5 s.

## 3. fx classes (from `engine/fx.css`)

| Class | Motion |
|---|---|
| `fx-up` | rise 10 px in, sink out |
| `fx-view` | slide 64 px in from the right (whole views) |
| `fx-pop` | scale 0.6 → 1 (with `b` ease) |
| `fx-rise` | rise from its clip (title words) |
| `fx-slide` | carousel slide in/out |
| `fx-settle` | scale 1.06 → 1 |
| `fx-nudge` | 8 px in from the left |
| `fx-draw` | SVG stroke draws (needs `pathLength="1"`) |
| `fx-wipe` | scaleX 0 → 1 (SVG mask rect wipe) |
| `fx-bar` | scaleY 0 → 1 from the bottom |
| `fx-dim` | dims to 28 % on out |
| `fx-press` | scales down 6 % on pulse |
| `fx-caret` | blinking caret after typed text |
| `fx-shimmer` / `fx-shimmer-text` | loading skeleton / "working…" text shimmer |
| `fx-spin-border` | rotating conic gradient (AI input ring) |

For your own effects, write CSS on `--p`, `--o`, `--k`, or the root's `--t` (story seconds), `--spin`, `--shimmer` and `--caret`. Use `.mo .your-class { … }` so it beats the generic opacity rule.

## 4. Camera and cursor (`story.ts`)

```ts
camera: [
  { at: [0, 0], focus: "input", scale: 2.4 },            // start tight on the prompt
  { at: [3.45, 5.4], focus: "world", scale: 1 },          // pull back to the workspace
  { at: [10.2, 11.2], focus: "chart", scale: 1.55, ay: 0.4 },
],
portraitCamera: [ … ],     // 9:16 path: visit one panel at a time (omit scale to fit the target)
cursor: [{ at: [7.8, 8.7], focus: "row", ax: 0.45 }],      // glide; ax/ay anchor, dx/dy offset in px
cursorVisible: [[7.7, 9.5]],
clicks: [8.9],                                             // press + ripple (+ automatic click sound)
```

Between two shots the camera zooms around the one point that stays still on screen, so moves feel like a real camera. Use `focus: "world"` for the whole stage. A shot without `scale` fits its target, plus `pad` (24 px).

## 5. Title cards (in `Overlay`)

```tsx
<div className="mo-titles">
  <h2 className="mo-title" data-out="-3.3 .5 io">
    <span className="mo-title-line is-soft"><Rise text={c.titles.hook} at={-5.8} /></span>
    …
  </h2>
  <span className="mo-backdrop mo-paper" data-in="15.8 .8 io" />   {/* end card backdrop */}
  …
</div>
```

`Rise` makes each word rise out of its own clip, 0.07 s apart. Put the intro at negative story times and the end card after the last beat.

## 6. Sound cues (`AUDIO` in `story.ts`)

`cues: [{ at: <story s>, kind: "typing" | "pop" | "count" | "chart" | "answer" | …, dur?, volume? }]`. Each `kind` maps to a file in `AUDIO.sfx` (in `public/`); missing files are skipped. Cues are placed in story time and follow the sync map. The voice, music bed and speech-ducking come from `sync.json` (motion-audio).

## 7. Formats

- **`Film-landscape`** is 1920×1080: the 1280×720 stage scaled 1.5×.
- **`Film-portrait`** is 1080×1920: a 720×1280 stage over the same world. Use `portraitCamera` (or per-shot `portrait: {…}` overrides).
- Title cards reflow; `.is-portrait` on the root lets CSS adjust sizes.

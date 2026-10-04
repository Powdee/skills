# motion-engine.js — reference

`<motion-graphic>` is a custom element with no dependencies. Load `motion-engine.js` as an ES module
and `motion-engine.css` globally.

## Contents
1. Markup contract
2. Storyboard JSON
3. Timing attributes
4. Effect classes
5. Camera
6. Pointer
7. Chapters, player and keyboard
8. Soundtrack and time warp
9. JavaScript API
10. CSS hooks
11. Gotchas

## 1. Markup contract

```html
<motion-graphic class="mg" data-number-locale="en-GB">
  <script type="application/json" data-storyboard>{ …see 2… }</script>
  <div class="mg-frame">                      <!-- sized by the page; aspect ratio set from the stage -->
    <div class="mg-stage" aria-hidden="true">  <!-- design-pixel stage, scaled with --mg-scale -->
      <div class="mg-world">…product UI…</div>  <!-- moved by the camera -->
      …stage-space overlays: title cards, notices (do not move with the camera)…
      <span class="mg-ripple"></span>
      <svg class="mg-cursor" viewBox="0 0 24 24" width="24" height="24"><path d="M5 2.5v17.2l4.3-4.2 2.9 6.6 3-1.3-2.9-6.5h6.1z"/></svg>
    </div>
  </div>
  <div class="mg-controls">                    <!-- optional player -->
    <button class="mg-toggle" data-mg-toggle data-play-label="Play" data-pause-label="Pause" data-replay-label="Replay">
      <svg class="mg-icon-play">…</svg><svg class="mg-icon-pause">…</svg><svg class="mg-icon-replay">…</svg>
    </button>
    <div class="mg-chapters"><button class="mg-chapter" data-mg-chapter aria-label="…"><span><i></i></span></button>…</div>
    <button class="mg-mute" data-mg-mute data-mute-label="Mute" data-unmute-label="Unmute">…mg-icon-sound / mg-icon-muted…</button>
  </div>
  <audio src="soundtrack.mp3" preload="none" data-sync="[[0,-6],[51,45]]"></audio>   <!-- optional -->
</motion-graphic>
```

One chapter button per storyboard chapter, in order. `data-number-locale` formats `data-count`.

## 2. Storyboard JSON

```json
{
  "stage": { "width": 1280, "height": 720 },
  "start": -6,
  "duration": 45,
  "chapters": [{ "at": -6, "settle": -3.6, "label": "Intro" }, { "at": 0 }, { "at": 3.45 }],
  "camera": [
    { "at": [0, 0], "focus": "input", "scale": 2.4 },
    { "at": [3.45, 5.4], "focus": "world", "scale": 1 },
    { "at": [24.4, 25.7], "focus": "board", "scale": 1.34, "ay": 0.36 },
    { "at": [10.4, 11.6], "focus": "aerial", "pad": 28 }
  ],
  "cursor": {
    "moves": [{ "at": [7.7, 7.7], "focus": "detail", "ax": 0.4, "ay": 0.55 }, { "at": [7.8, 8.7], "focus": "row", "ax": 0.45 }],
    "visible": [[7.7, 9.5]],
    "clicks": [8.9]
  },
  "sfx": [{ "at": 19.6, "sound": "click" }]
}
```

- Times are **storyboard seconds**. `start` may be negative: title cards before the product part
  keep the product timings anchored at 0.
- `settle` = the frame shown when a chapter is opened with reduced motion (default: its last frame).
- `sfx` is read by motion-soundtrack's `events.cjs`, not by the engine.

## 3. Timing attributes

| Attribute | Value | Writes |
|---|---|---|
| `data-in` | `start dur [ease]` | `--p` 0→1 |
| `data-out` | `start dur [ease]` | `--o` 0→1 |
| `data-pulse` | `start dur` | `--k` 0→1→0 (sine) |
| `data-slot` | `from to start dur [ease]` | `--slot` (e.g. `top: calc(var(--slot) * 44px)`) |
| `data-type` | `start end [clear]` + `data-text` | textContent typed with a natural rhythm; emptied at `clear` |
| `data-count` | `start dur [ease]` + `data-value` `[data-from]` `[data-decimals]` | formatted number |
| `data-scroll` | `start dur [ease]` | element `scrollTop` → its end |
| `data-focus` | name | target for camera/pointer |
| `data-sfx` | sound name | sound cue (read by events.cjs) |

Eases: `l` linear, `o` out-cubic (default), `io` in-out-cubic, `b` out-back (overshoot).

## 4. Effect classes

Any element with `data-in`/`data-out` fades with `opacity: --p × (1 − --o)`. Add a class for motion:

| Class | Motion |
|---|---|
| `fx-up` | rises 10 px in, rises 10 px out |
| `fx-view` | slides 64 px from the right in, to the left out (view switches) |
| `fx-pop` | scales 0.6 → 1 (pair with ease `b`) |
| `fx-nudge` | slides 8 px from the left |
| `fx-settle` | scales 1.06 → 1 |
| `fx-rise` | rises from below its own clip (title-card words inside `.mg-word`) |
| `fx-slide` | full-width carousel slide, no fade |
| `fx-draw` | SVG stroke draws (`pathLength="1"`) |
| `fx-wipe` | `scaleX` reveal for a `<rect>` inside an SVG `<mask>` (dashed lines) |
| `fx-bar` | `scaleY` from the bottom (bar charts) |
| `fx-dim` | dims to 28 % with `--o` (de-emphasise alternatives) |

Composite transforms (e.g. an element that both enters with `--p` and pulses with `--k`) need one
custom `transform` rule that uses both variables, at higher specificity (`.mg .my-el { … }`).

## 5. Camera

- Each shot: `at: [start, end]`, `focus` (a `data-focus` name or `"world"`), then either `scale`
  or fit-to-element with `pad`. `ax`/`ay` pick the point inside the element (0..1; values outside
  frame above/beside it).
- Between shots the camera zooms around the one world point that stays still on screen; equal
  scales pan linearly. Easing is in-out cubic.
- Focus rectangles come from layout offsets, so entrance transforms on ancestors do not shift the
  framing. Elements positioned with `top` (like sorting rows) are followed live.
- The world can be zoomed beyond its edges; give `.mg-world` and the frame the same background so
  the outside is invisible, or add a large "paper" layer behind the panels for the intro.

## 6. Pointer

- `moves`: `[start, end]` + focus point (`ax`, `ay`, `dx`, `dy`). A zero-length move jumps (use
  it as the first move of each visible window).
- `visible`: windows with 0.25 s fade-in and 0.3 s fade-out.
- `clicks`: press scale + ripple at the pointer. Make the UI react at the same time (`data-pulse`,
  a highlight with `data-in`).
- The pointer lives in stage space, so it stays the same size while the camera zooms.

## 7. Chapters, player and keyboard

- Click on the frame toggles play/pause; Space works on the focused toggle; ←/→ jump chapters.
- Chapter segments fill with progress (`--fill`); their widths follow chapter lengths.
- `prefers-reduced-motion`: `start()` shows chapter 1's settled frame paused; chapter buttons jump
  to settled frames; Play still plays if the person asks.

## 8. Soundtrack and time warp

`<audio data-sync="[[t_audio, t_storyboard], …]">` makes the track the master clock. Playback time
runs from the first pair's audio time to the last; a monotone cubic curve through the pairs maps
it to storyboard time, so the animation speeds up and slows down smoothly to land actions on the
words. Without voice, use the storyboard's own pacing shifted to start at 0:
`[[0, start], [duration − start, duration]]`.

The engine waits up to 2 s for the track to start, follows `currentTime` when the two drift more
than 80 ms (buffering), keeps animating if the track fails, and exposes a mute button.

## 9. JavaScript API

| Member | Use |
|---|---|
| `start()` | from the beginning (reduced motion: first settled frame) — call on user gesture so audio may play |
| `stop()` | pause and rewind (call when a modal closes) |
| `play()` / `pause()` / `toggle()` | transport |
| `seek(storyboardTime)` | render a storyboard moment (QA) |
| `render(playbackTime)` | render a playback moment (export, sync checks) |
| `toPlayback(storyboardTime)` | first playback time reaching a storyboard time |
| `warp(playbackTime)` | playback → storyboard |
| `begin`, `end`, `time`, `stageWidth`, `stageHeight`, `storyboard` | state |
| `MotionGraphic.keystrokes(text, start, end)` | the typing rhythm (static) |

## 10. CSS hooks

`--p`, `--o`, `--k`, `--slot` (per element) · `--mg-scale` (stage scale) · `--fill`, `--length`
(chapters) · `--mg-ring-fill`, `--mg-ring-colors` (input ring) · `--mg-ripple`,
`--mg-controls-bg`. `data-state` on the element: `playing` | `paused` | `ended`; `data-muted`.

## 11. Gotchas

- `@property` registrations make `--p/--o/--k` non-inherited — nested animated elements need their
  own attributes; children of an animated parent inherit its opacity, not its progress.
- Absolutely positioned children of a grid container do not take grid cells — good for overlays.
- Stacked grid children (`grid-area: 1/1`) keep their height even when invisible; clear text or
  collapse them when the stack should shrink.
- `mask`/`clip-path` children, `<tr>` transforms and SVG text transforms work in current
  browsers; test Safari if you rely on them.

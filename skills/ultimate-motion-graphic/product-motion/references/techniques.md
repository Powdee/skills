# Techniques — recipes that worked

Each recipe is a pattern from a shipped piece. Classes are examples; the attributes and `fx-*`
classes are the engine contract (see engine.md).

## Contents
1. Title cards with rising words
2. An input that draws itself, then flows
3. Typing a question and sending it
4. One-shot pull-back from the input into the product
5. A list that sorts itself
6. Skeleton → content after a click
7. Count-ups
8. An assistant that answers in words
9. Carousel of evidence
10. SVG: outline, extrusion, dashed-line wipe, highlight
11. Switching views inside the app
12. Bars, a schedule that pops by column, a scrolling panel
13. End card
14. Notices and attribution
15. Camera shot patterns

## 1. Title cards with rising words

Stage-space overlay (outside `.mg-world`) so the camera does not move it. Generate one `.mg-word`
per word, 0.07 s apart; leave as a whole with `data-out`.

```html
<div class="cards"> <!-- position:absolute; inset:0; display:grid; place-items:center; z-index:3 -->
  <h2 class="card fx-up" data-out="-3.3 .5 io">
    <span class="soft"><span class="mg-word"><span class="fx-rise" data-in="-5.8 .7">Investment</span></span> …</span>
    <span class="mg-word"><span class="file fx-rise" data-in="-5.4 .7">
      <svg>…spreadsheet icon…</svg>plan_final_v<span data-count="-4.7 1.2 l" data-from="1" data-value="7" data-sfx="tick">1</span>.xlsx
    </span></span>
  </h2>
</div>
```

A counting artefact (v1 → v7) makes the pain concrete. If a flex child sits inside `.mg-word >
span`, raise its specificity (`.mg-word > .file { display: inline-flex; gap: .32em }`) — the word
rule sets `display: inline-block`.

## 2. An input that draws itself, then flows

```html
<div class="input" data-focus="input">          <!-- position:absolute; border-radius:11px; border:2px solid transparent -->
  <span class="glow" data-in="0.6 .8" data-out="3.4 .8"></span>   <!-- optional blurred ring, z-index:-1 -->
  <span class="mg-ring" data-in="0.1 1.1 io"><i></i></span>          <!-- fill + gradient border, left → right -->
  <div class="field" style="position:relative">…</div>
  <span class="send" data-in="0.85 .45 b" data-pulse="3.2 .35" data-focus="send" data-sfx="click">↑</span>
</div>
```

The ring is both the input's fill and its border, so nothing shows before the sweep. Content
inside must be positioned (or transformed) to paint above the ring.

## 3. Typing a question and sending it

```html
<div class="field">   <!-- display:grid; grid-template-columns:minmax(0,1fr); children grid-area:1/1 -->
  <span class="placeholder" data-in="0.75 .3" data-out="1.25 .12">Ask your portfolio…</span>
  <span class="placeholder" data-in="3.7 .3" data-out="16.75 .12">Ask your portfolio…</span>
  <span class="mg-typed" data-type="1.3 3 3.6" data-text="What should be repaired first?" data-in="1.25 .05" data-out="3.4 .2"></span>
</div>
```

`minmax(0,1fr)` lets long questions wrap. The third `data-type` value empties the text after the
fade so the input shrinks back. A second placeholder returns after send.

## 4. One-shot pull-back from the input into the product

Start the camera on the input (`scale ≈ 2.4`), hide everything else, and reveal the app as the
camera pulls back:

- a "paper" layer (page background + dot grid, `inset: -720px -1280px`) inside the world, `data-out`
  during the pull-back;
- the assistant panel's white skin as a separate element with `data-in` (the input must stay
  visible, so the panel itself cannot fade);
- rail, list and detail panels with staggered `data-in` + `fx-up` (0.15 s apart).

Camera: `{ "at": [0,0], "focus": "input", "scale": 2.4 }` → `{ "at": [3.45,5.4], "focus": "world", "scale": 1 }`.

## 5. A list that sorts itself

```css
.row { position:absolute; top: calc(var(--slot, 0) * 44px); left:0; right:0; background:#fbfbfa; isolation:isolate; }
.row.is-selected { z-index: 2; }
```
```html
<li class="row fx-up is-selected" data-in="4.82 .4" data-slot="6 0 6.1 1.15 io" data-focus="row">…</li>
```

Rows arrive in a scrambled order (`data-in` staggered by arrival slot), then move from `from` to
`to` with a small per-row delay. Opaque backgrounds keep crossing rows readable.

## 6. Skeleton → content after a click

Stack a shimmering skeleton (`data-out` at the click) and the real content (`data-in` just after)
in the same box. Children of the content stagger (header, KPIs, image) 0.07–0.15 s apart.

## 7. Count-ups

```html
<dd><span data-count="9.2 .9" data-value="39">0</span> / 100</dd>
<dd><span data-count="32.2 1.5" data-value="13.9" data-decimals="1">0</span> CZK m</dd>
```

Decimals and separators follow `data-number-locale`.

## 8. An assistant that answers in words

```html
<div class="thread">
  <h3 class="fx-up" data-in="19.8 .6">Why does Residential Prosek 01 have a higher priority?</h3>
  <div class="swap">                                         <!-- grid stack -->
    <p class="status" data-in="20.05 .3" data-out="21.1 .3">Checking the model and sources</p>  <!-- shimmer -->
    <p class="answer fx-up" data-in="21.15 .5" data-sfx="chime">… mainly because of the roof:</p>
  </div>
  <ol class="card fx-up" data-in="21.4 .5"> <li class="fx-up" data-in="21.6 .45">…</li> … </ol>
  <div class="chips"><span class="fx-pop" data-in="22.7 .35 b">Inspection 14 Apr</span>…</div>
</div>
```

For a streamed answer use `data-type` without `.mg-typed` (no caret, no keyboard sound), then show
the reference card (row, chart) after it.

## 9. Carousel of evidence

```html
<div class="aerial" data-focus="aerial"> <!-- overflow:hidden -->
  <div class="slide fx-slide" data-out="12.8 .6 io">…map + SVG…<span class="attribution">Orthophoto © ČÚZK</span></div>
  <div class="slide fx-slide" data-in="12.8 .6 io" data-out="13.8 .6 io"><img …></div>
  <div class="slide fx-slide" data-in="13.8 .6 io"><img …></div>
  <span class="arrow next" data-focus="next-photo">›</span>
  <span class="dots"><i></i><i></i><i></i><b style="--index:0" data-in="9.3 .3" data-out="12.8 .3"></b>…</span>
</div>
```

The pointer clicks the arrow at each slide time. Decode images before playback (the engine's
`start()` does this) or the first slide-in stutters.

## 10. SVG: outline, extrusion, dashed-line wipe, highlight

- Outline: `<path class="fx-draw" pathLength="1" d="…" data-in="9.8 .9 io">` with
  `stroke-linejoin: round`. Stroke widths are in the SVG's own units; scale them to the viewBox.
- 3D extrusion over an aerial photo: draw the ground footprint, then vertical edges (one path per
  corner, staggered 0.08 s), then the roof outline, then fade faces and roof fill.
- Dashed lines cannot use the dash-draw trick; reveal them with a mask:
  ```html
  <mask id="wipe-a" maskUnits="userSpaceOnUse" x="0" y="0" width="980" height="290">
    <rect class="fx-wipe" width="980" height="290" fill="#fff" data-in="25.6 1.3 io"/>
  </mask>
  <path d="…" mask="url(#wipe-a)" stroke-dasharray="7 7" …/>
  ```
- Emphasis after a choice: dim the others with `fx-dim` + `data-out`, and draw a thicker overlay
  path along the chosen line with `fx-draw`.

## 11. Switching views inside the app

Stack views absolutely in the main area; the outgoing view gets `data-out` + `fx-view`, the
incoming one `data-in` + `fx-view` 0.2 s later. Move the rail's active indicator with one
highlight element per view (`data-in`/`data-out` windows) at `top: calc(var(--index) * 42px)`.

## 12. Bars, a schedule that pops by column, a scrolling panel

- Bars: `<div class="bar fx-bar" style="height:63%" data-in="32.8 .7">` with stacked segment
  spans inside; values pop after (`data-in` +0.5 s).
- Schedule table: chips get `fx-pop` with `data-in = start + column × 0.17` and `data-sfx="pop"` —
  one sound per column (same-time cues merge).
- Panel too tall for the stage: make the body a scroll container with `data-scroll="35.3 1.2 io"`;
  keep the camera on the panel while its content scrolls under it.

## 13. End card

```html
<span class="end-backdrop" data-in="41.5 .8 io"></span>  <!-- page background over the world -->
<div class="end"> <!-- flex column, centred -->
  <img class="logo fx-pop" src="logo.svg" data-in="41.9 .6 b" style="width:96px">
  <h2 class="card">…words rising from 42.35…</h2>
</div>
```

Close the hook ("The last version of your investment plan.") and keep it to logo + one line.

## 14. Notices and attribution

- Illustrative-data pill in stage space, bottom-left, visible for the product part:
  `<span class="notice" data-in="4.2 .5" data-out="41.4 .4">Illustrative data</span>`.
- Third-party imagery credit inside the slide that shows it, so it moves with the image.

## 15. Camera shot patterns

```json
[
  { "at": [0, 0], "focus": "input", "scale": 2.4 },                   // open on the question
  { "at": [3.45, 5.4], "focus": "world", "scale": 1 },               // reveal the product
  { "at": [15.7, 16.7], "focus": "input", "scale": 1.85, "ay": -1.4 }, // look above a bottom-anchored input
  { "at": [19.75, 20.9], "focus": "copilot", "scale": 1.8, "ay": 0.3 }, // follow the answer as it grows
  { "at": [21.9, 23.4], "focus": "copilot", "scale": 1.8, "ay": 0.62 },
  { "at": [24.4, 25.7], "focus": "board", "scale": 1.34, "ay": 0.36 }, // include the header, not just the chart
  { "at": [39.6, 41.4], "focus": "world", "scale": 1 }                // pull out before the end card
]
```

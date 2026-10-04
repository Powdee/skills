# Integration

## Where the files go

Copy `motion-engine.js` and `motion-engine.css` into the project (e.g. `src/scripts/` and
`src/styles/`, or `public/` for a static site). They have no dependencies and no build step.
Keep the piece's markup and its own CSS together (one component + one stylesheet).

## Plain HTML / static sites

```html
<link rel="stylesheet" href="/motion-engine.css">
<motion-graphic class="mg">…</motion-graphic>
<script type="module">
  import "/motion-engine.js";
  await customElements.whenDefined("motion-graphic");
  document.querySelector("motion-graphic").start();   // or start on a button click
</script>
```

ES modules do not load from `file://`; serve the folder over HTTP.

## Astro

- One component (`HowItWorksMotion.astro`) holding the markup, a per-locale copy map in the
  frontmatter, and `<script>import "../scripts/motion-engine.js";</script>` (Astro bundles it).
- Import the CSS in the frontmatter (`import "./motion.css"`) — global, not scoped, because the
  engine contract classes must match.
- Generate repeated markup (rows, words, chips) from data in the frontmatter so timings stay
  computed (`data-in={\`${start + i * 0.07} .7\`}`), and share demo data with the rest of the site
  from one module.

## React / Next.js

- Render `<motion-graphic>` as a custom element in a client component; import the engine in a
  `useEffect` (it touches `window`).
- Put the storyboard JSON in `<script type="application/json" data-storyboard
  dangerouslySetInnerHTML={{ __html: JSON.stringify(storyboard) }} />`.
- Declare the element for TypeScript: `declare global { namespace JSX { interface
  IntrinsicElements { "motion-graphic": any } } }` (or the React 19 equivalent).
- The engine reads the DOM once on connect; remount (change `key`) if the storyboard changes.

## As a modal player

```js
trigger.addEventListener("click", event => {
  event.preventDefault();
  dialog.showModal();
  customElements.whenDefined("motion-graphic").then(() => motion.start()); // user gesture → audio may play
});
dialog.addEventListener("close", () => motion.stop());
```

Size the dialog for the 16:9 stage plus the 44 px controls:
`width: min(1120px, calc(100vw - 32px), calc((100dvh - 92px) * 16 / 9))`. Keep the stage
`aria-hidden` and label the dialog; the player buttons carry localised `aria-label`s.

## Localisation

Keep one copy map per locale next to the markup; check every locale with `frames.cjs` — headlines
that fit in English often wrap in Czech or German. Inflected languages need grammar to follow the
nouns you choose ("Its condition" → "Jeho stav" for a masculine building name).

## Server headers for sound and video

Safari only plays media served with byte ranges. Make sure the server sends
`Content-Type: audio/mpeg` (or `video/mp4`) and answers `Range` requests with `206 Partial Content`
and `Accept-Ranges: bytes`. Static hosts and CDNs do this; hand-written Node servers often do not.
Serve media with revalidation (`max-age=0, must-revalidate`) if files keep their names across edits.

## Performance

- The engine writes CSS variables and transforms only; one layout read per frame (camera/pointer).
- Decode large images before playback (`start()` does it); lazy-load them otherwise.
- Avoid `will-change: transform` on the world — text would rasterise blurry at zoom.
- Expect p99 ≈ 16.7 ms on a laptop with `pacing.cjs`.

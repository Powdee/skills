# Measured verification — Figma node vs built story

Eyeballing a story next to a Figma frame catches a wrong colour and misses
everything else. A 1px baseline offset, 4px of stray leading and a clipped
number all look like "close enough" at screen scale. Measure instead.

Scope it: measure when someone says something looks off, when text stacks
vertically, and once over the state matrix. Not for every story.

## The procedure

1. **Get the Figma node at native size.** `get_screenshot` will not upscale past
   the node's natural dimensions — a 224×36 button returns 224×36 whatever
   `maxDimension` says. Download it; don't try to read detail off the inline
   render.
2. **Screenshot the same story at the same CSS size**, `deviceScaleFactor: 1`,
   as an *element* screenshot so you get the component's box and nothing else.
3. **Compare programmatically.** Load both PNGs into a canvas and read the
   pixels. Glyph-bottom row per text band answers baseline questions; column
   bands answer spacing and truncation questions.
4. **Only then look at them side by side**, upscaled 4× with
   `image-rendering: pixelated`, to interpret what the numbers said.

## What the numbers mean

- **Glyph bottom row** ≈ the baseline, for text with no descender (`Title`, `MENU`, `12`). Equal bottoms in both images = faithful, whatever it
  looks like.
- **Column bands** with a gap threshold of ~4px separate words; a band that
  merges in one image and splits in the other is a sub-pixel spacing difference,
  not a real one.
- **A 1px difference is usually the design, not the port.** Verify before
  "fixing" it — see the baseline note below.

## Working snippets

Run from the package directory, because ESM resolves
`playwright` from the script's location and there is no `node_modules` in the
scratchpad. `node --input-type=module -e "$SCRIPT"` with the script in a quoted
heredoc avoids shell mangling of template literals.

**Element screenshot.** `locator('button')` throws a strict-mode violation —
Storybook injects its own buttons into the preview iframe. Select the
component's own element:

```js
await p.goto('http://localhost:6006/iframe.html?id=<story-id>&viewMode=story',
             { waitUntil: 'networkidle' });
await p.waitForTimeout(1200);
await p.locator('[data-testid="target"]').screenshot({ path: out });
```

**Composing a comparison.** `file://` sources do not load under `setContent`.
Inline them:

```js
const b64 = (f) => 'data:image/png;base64,' + readFileSync(dir + '/' + f).toString('base64');
```

**Reading geometry from the DOM** — often enough on its own, and exact:

```js
await p.evaluate(() => {
  const el = document.querySelector('button[aria-pressed]');
  return [...el.querySelectorAll('span')]
    .filter((s) => !s.children.length && s.textContent.trim())
    .map((s) => {
      const r = s.getBoundingClientRect();
      const cs = getComputedStyle(s);
      const fs = parseFloat(cs.fontSize), lh = parseFloat(cs.lineHeight);
      return { text: s.textContent.trim(), fs, lh,
               approxBaseline: r.top + (lh - fs) / 2 + fs * 0.727 };
    });
});
```

**Pixel scan** for glyph bottoms and column bands: draw each PNG to a canvas,
threshold luminance (~205 catches 50%-opacity text; ~140 only catches near-black
and will miss muted metadata), collect columns containing ink, merge bands
separated by ≤4px.

## The baseline note

`items-center` aligns **boxes, not baselines**. Text at 14px in a 20px line box
next to text at 10px in a 12px box centres both boxes and leaves the baselines
about 1px apart. Figma's layout does exactly the same thing, so this offset is
usually *in the design* and the faithful port reproduces it.

A worked example: glyph bottom rows measured 22 for one label and 21 for another
in **both** the Figma render and the build.

So: verify before changing anything. If the offset is real and unwanted, fixing
it means putting the two texts in one `items-baseline` container — a structural
divergence from the design, which makes it a question for the designer, not a
silent correction. Otherwise every future port re-introduces it.

## Readings the browser will not give you back

`getComputedStyle(...).borderBottomWidth` returns `1px` for a `1.5px` border —
the used value is snapped, and raising `deviceScaleFactor` does not change it.
Before filing a hairline border as a cascade bug, measure a sibling that
carries the same width unconditionally. If both read `1px`, the stylesheet is
fine and the reading is the artifact.

ESM resolves imports against the *script's* directory, not the cwd. A probe
script in the scratchpad cannot `import "playwright"` however you invoke it —
import it by absolute path to the repo's own `node_modules/playwright/index.mjs`.

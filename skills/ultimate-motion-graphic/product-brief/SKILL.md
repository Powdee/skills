---
name: product-brief
description: "Understand a product before making anything about it. Reads its landing page (source or live URL) and, when available, the platform itself, then writes .claude/product-brief.md: what the product does, who it is for, the problem and the promise, the flows worth showing, real copy and numbers with their sources, the demo data and its risks, and the brand kit (colours, type, radii, shadows, UI look, voice). Use this first for any product video, motion graphic, explainer, demo, ad or landing work on a product that has no brief yet, and when someone says 'understand the product', 'learn our brand', 'what does this product do', or product-motion finds no brief."
---

# /product-brief — know the product before you show it

Everything downstream — the storyboard, the UI you rebuild, the voice-over, the music — is only as
good as your understanding of what the product is and how it looks. Guessing produces fluent,
generic work that the owner immediately recognises as not theirs. This skill replaces guessing with
facts taken from the product's own surfaces, each traceable to where it came from, and confirmed by
a person before anything is built on them.

**Output:** `.claude/product-brief.md` in the project (ask where to put it if there is no repo).
Every other skill in this family reads it.

## STEP 0 — Is there already a brief?

If `.claude/product-brief.md` exists, read it and ask whether anything changed (new feature,
rebrand, new audience). Refresh only the sections that moved. A brief that is right is worth more
than a brief that is new.

## STEP 1 — Find the sources

Ask which of these exist, and get access to all of them that do. They answer different questions:

| Source | Best for | How to read it |
|---|---|---|
| Landing page source (repo) | positioning, copy, claims, sections, brand tokens | read the pages and components; `scripts/scan-brand.py` |
| Live landing URL | what visitors actually see, rendered type and colour | `scripts/capture.cjs` |
| The platform (repo or running app) | real screens, real flows, UI components, empty/loading states | read the views; capture a dev server or staging URL |
| Docs, pitch deck, onboarding | vocabulary, the problem in the customer's words | read |

**Prefer the product over the marketing.** The landing page tells you what the company wants to
say; the platform tells you what the product does. A motion graphic must survive someone who uses
the product watching it. When they disagree, note both and ask.

```bash
eval "$(bash <skill-dir>/scripts/setup-tools.sh)"      # once: Playwright + ffmpeg in a shared cache
node <skill-dir>/scripts/capture.cjs --url https://product.example --out .claude/brief-capture
python3 <skill-dir>/scripts/scan-brand.py <path-to-landing-or-app-source>
```

`capture.cjs` writes full-page desktop/mobile screenshots, one screenshot per section and
`outline.md` (the page's text in reading order plus computed type and colour of key elements).
**Look at the screenshots** — open them with the Read tool. Numbers about a brand are not a brand.

## STEP 2 — Understand the product

Work out, with evidence:

1. **One-sentence what.** What it does, for whom, in the product's own vocabulary.
2. **The problem**, as the customer feels it (look for pain words in the copy: spreadsheets,
   scattered, manual, late, risk…). This becomes the hook of a video.
3. **The promise** — the outcome the product claims (the hero headline usually says it).
4. **Audiences** — who buys, who uses; their sophistication and what they would recognise.
5. **Key flows worth showing** — 3 to 6 moments where the product visibly does something a person
   could not easily do otherwise (rank, answer, compare, plan, detect). For each: the screen it
   happens on, the input, the visible output, and the file or URL it comes from.
6. **Proof points** — numbers, named features, claims. Mark each **real** (from the product or a
   cited source) or **illustrative** (demo data, mock numbers).
7. **Words to reuse** — headings, button labels, UI strings, taglines. Reusing the product's own
   words is what makes a video feel like *this* product.
8. **What not to show or say** — unreleased features, claims legal has not cleared, competitors.

## STEP 3 — Extract the brand kit

From `scan-brand.py`, the computed samples in `outline.md` and the screenshots, settle:

- **Colours:** page background, surface/panel, ink, muted text, lines, the brand colour, accents,
  status colours (good/warn/bad), any signature gradient. Give hex values and where each is used.
- **Type:** families and the files that load them, weights in use, the display sizes, line-height,
  and how headlines are styled (e.g. two-tone headline: muted first clause, ink second).
- **Shape and depth:** radii (controls, cards, panels), borders, shadows.
- **UI look:** the app's layout grammar (rail, list, detail, side panel…), density, iconography
  (library and stroke), how AI/assistant surfaces are marked (gradients, glow), chart style.
- **Motion cues** already on the site: easing, durations, hover behaviour.
- **Voice:** formal/informal, sentence length, languages and locales shipped.

Doubt the scan. The most-used colour is usually white or a line colour, not the brand. A token that
is defined may be dead. Two token files may be a duplicate kept in sync by hand. Confirm against
the screenshots before writing a value down.

## STEP 4 — Check the demo data

Product previews are often filled with plausible fakes. Before they go into a video that will be
shared widely, list anything that could cause harm or embarrassment:

- **Real, identifiable entities with invented claims** — real addresses, buildings, companies or
  people shown with made-up scores, defects, debts or opinions. Recommend replacing them with
  internal-style names (type + area + number, e.g. "Residential Prosek 01") rather than inventing
  new street numbers, which usually collide with real ones.
- **Third-party imagery** that needs credit — map tiles, orthophotos, stock photos, open data
  (e.g. CC BY sources need attribution on or next to the image).
- **Illustrative numbers** that should carry an "illustrative data" notice.

Report these as findings with file references; the decision belongs to the owner.

## STEP 5 — Write the brief and confirm it

Write `.claude/product-brief.md` using `references/brief-template.md`. Cite a file path or URL for
every claim and value. Then show the person a short summary — the one-sentence what, the problem,
the 3–6 flows, the brand colours and type, and the demo-data findings — and ask what is wrong or
missing. Do not move on to a storyboard until they confirm. A wrong brief costs one message to fix
now and a re-render later.

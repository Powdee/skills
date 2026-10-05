---
name: motion-brief
description: Stage 1 of the ultimate-motion film pipeline. Studies a product (codebase, app UI, landing page, docs) and its brand, then writes a short brief for a motion-graphics product film. The brief covers the angle, the familiar pain for the intro, 3–6 product moments worth animating, real copy and data to reuse, brand tokens (fonts, colours, logo) and formats. Use when starting a product explainer, teaser, intro/outro or "how it works" animation, when /ultimate-motion calls it, or when the user asks what such a film should show.
---

# Motion brief

A motion film is only as good as its understanding of the product. Spend this stage reading, not designing.

## 1. Find the source of truth

In priority order: the landing page source (positioning and the exact words the company uses), the app's UI code and seed or demo data (what the screens really look like and contain), then docs and README.

Note file paths for everything you'll reuse. The build stage recreates these screens, so you want the real layout, labels, numbers and example names, plus any existing "how it works" section, demo data module or screenshots.

## 2. Brand

```sh
python3 <skill-dir>/scripts/extract_brand.py <repo> --copy-to <film-project>
```

This prints colour variables, the most-used colours, font families, font files and logo files, and copies fonts and logos into the film project's `public/`. Decide the real roles yourself:

- **ink**: text colour;
- **paper / workspace**: backgrounds;
- **accent**: the primary brand colour;
- **semantic colours**: risk red, warning amber, OK green, if the UI uses them.

Note whether the brand font is available as woff2. If it isn't, pick the closest system font and say so.

## 3. Write brief.md (in the film project)

Keep it to about one page:

- **Angle:** one sentence on what the viewer should believe afterwards.
- **Audience and use:** landing page, social, sales deck.
- **The pain**, for the intro title cards: the familiar bad version of the job, ideally with a concrete, slightly funny artefact. Examples: `investment_plan_final_v7.xlsx`, a 40-tab spreadsheet, a Slack thread of "any update?".
- **The turn:** "There's a better way." and the first action. Very often that's a question typed into the product.
- **Product moments**, 3–6 of them. For each: the screen and file path, what changes on screen, the real copy and numbers to show, and why it matters to the viewer.
- **End card:** logo plus a line that answers the pain.
- **Formats and lengths, languages, voice-over plan** (the user supplies it), music and SFX the user has.
- **Data honesty:** which numbers are real and which are illustrative and need an on-screen notice.

## Checkpoint

Show the user the angle, the pain or gag, and the list of moments in a few lines, in their language. Confirm before scripting, because changing the story later is the expensive part.

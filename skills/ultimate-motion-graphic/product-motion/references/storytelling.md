# Storytelling for product motion

## Contents
1. The shape
2. Timing budgets
3. Hooks that work
4. Copy rules
5. Camera and pointer grammar
6. Demo data and legal hygiene
7. Storyboard template and a worked example

## 1. The shape

A product explainer answers one question the viewer already has ("which building do I fix
first?", "where is the money going?") by letting them watch the product answer it. Build it as a
chain where each beat causes the next:

| Beat | Purpose | Typical screen moment |
|---|---|---|
| **Hook** | Name a pain the audience owns, then turn | Two title cards: pain (with a concrete artefact) → "There's a better way." |
| **Ask** | Put the viewer's question into the product | An input draws itself; the question is typed and sent |
| **Show** | The product answers by doing | Camera pulls back into the app; a list sorts itself; the pointer opens the top item |
| **Evidence** | Prove it is grounded | Detail panel, photos with findings, sources |
| **Explain** | The assistant says why | Follow-up question; answer streams in with reasons and source chips |
| **Decide** | Compare options | Scenarios side by side; one is picked; chart responds |
| **Plan** | The outcome the viewer wanted | A plan, schedule or report fills in; the first step is highlighted |
| **End** | Brand + one line | Backdrop, logo, tagline that closes the hook |

Drop beats the product does not have. Never add a beat the product cannot do.

## 2. Timing budgets

- Total 40–60 s. Under 40 feels like a GIF; over 60 loses people before the payoff.
- 5–7 chapters (the player shows them as segments people can jump to).
- A beat needs ~1.5–3 s to read; a camera move 1–1.5 s; a cursor move 0.5–0.9 s; a click reaction
  0.25–0.4 s; typing ~20–30 characters per second (fast but legible).
- Title cards: words rise one by one (0.07 s apart), hold ~2 s, leave in 0.5 s.
- End card: hold at least 1.5 s after the last word.
- With a voice-over, budget the script per beat: Czech/Slovak ≈ 4.5 syllables/s, English ≈ 2.5
  words/s at a calm pace. The voice then drives the final timing (motion-soundtrack).

## 3. Hooks that work

The best-received hook named a pain the audience lives with and showed it as an artefact:

> *Investment plan for your buildings?* `investment_plan_final_v7.xlsx` — the version number
> counts v1 → v7 — then: *There's a better way.*

Patterns, ranked by how well they tested:
1. **The artefact of the pain** (a spreadsheet name, an inbox, a stack of PDFs).
2. **The tension**: "Budgets have a limit. / Technical debt doesn't."
3. **The number**: "214 buildings. 12 at risk. One budget." (only if the number is real or clearly illustrative)
4. **The unanswerable question**: "What should be repaired first?" — careful not to repeat it
   when the same question is typed in the next beat.

Write title cards in the site's headline style (e.g. two-tone: muted clause, ink clause).

## 4. Copy rules

- **The UI speaks for itself.** Use the product's real labels, headings and answers. Do not add
  captions that narrate the UI ("Here you can see…").
- **Added text is limited to title cards and the end card**, plus legally needed notices.
- **Assistant answers in words**, not just a result card: a one-sentence answer, then the
  reference (row, chart, source). Match grammar to the subject (gender, number) in inflected
  languages when names change.
- **Every locale gets the same story**; check text fit per locale at review.
- Numbers in UI: keep the product's formatting per locale (decimal commas, currency position).

## 5. Camera and pointer grammar

- **One-shot camera.** Prefer continuous moves over cuts: start zoomed on the input, pull back to
  reveal the product, push in on what matters, pull back out at the end.
- **Zoom for legibility, not drama.** Push in when text would be too small at full view (assistant
  answers, tables). Don't push into photos or maps unless asked.
- **Frame the subject,** not the element's centre: offset with `ay` (fraction of the element's
  height, may be negative to look above it) so bottom-anchored inputs do not leave an empty band.
- **The pointer appears only to act:** fade in near the target, glide 0.5–0.9 s, click, fade out.
  Ripple on every click; the UI reacts within 0.1 s (row highlight, button press).
- **Switch views inside the app** (rail icon moves, main area slides) rather than cutting to new
  screens.

## 6. Demo data and legal hygiene

- Never pair a real, identifiable entity (address, company, person) with invented negative claims.
  Use internal-style names: `<type> <area> <number>` ("Residential Prosek 01", "School Karlín 01").
  Inventing house numbers is not safe — most collide with real ones.
- Show a small, persistent "Illustrative data" notice during the product part when numbers are
  made up.
- Credit third-party imagery on the image itself (bottom corner of the slide), not on the end card.
- Strip identifying details from asset URLs and class names too (they are visible in page source).

## 7. Storyboard template and a worked example

| t (s) | Chapter | Beat | On screen | Camera | Pointer | VO line |
|---|---|---|---|---|---|---|
| −6.0 | Intro | Hook | "Investment plan?" + `plan_final_v1…v7.xlsx` | fixed | — | "Your investment plan in Excel. Version seven of 'final'…" |
| −2.6 | Intro | Turn | "There's a better way." | fixed | — | "There's a better way." |
| 0.0 | Question | Ask | Input draws; "What should be repaired first?" typed, sent | input ×2.4 | — | "Just ask: what should be repaired first?" |
| 3.5 | Portfolio | Show | Pull back; list sorts by risk; assistant answers in words | world ×1 | click top row at 8.9 | "It ranks the portfolio by risk…" |
| 9.0 | Detail | Evidence | Detail: KPIs count up; aerial outline; photo carousel | world | next-arrow ×2 | "Satellite images, documents, photos…" |
| 15.6 | Copilot | Explain | Follow-up typed; answer + 3 reasons + sources | assistant ×1.8 | input, send, "Compare" | "Why this one? The assistant explains…" |
| 24.3 | Scenarios | Decide | 3 budgets; risk chart draws; B picked | board ×1.34 | B, then top intervention | "At 30 million a year only two remain at risk…" |
| 31.3 | Plan | Plan | 10-year plan: KPIs, bars, schedule pops by year, first step | plan ×1.34 → ×1.4 | — | "Choose a plan, say ten years: what, when, how much." |
| 41.5 | End | End | Backdrop, logo, "The last version of your investment plan." | world | — | "Revitamal. The last version…" |

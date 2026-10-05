# Storytelling for product motion films

## Structure

| Part | Story time | What happens | Why |
|---|---|---|---|
| Pain | −6 … −3.3 | Title card: the familiar bad version of the job, plus a concrete artefact that gets worse (a file version counting v1 → v7) | Recognition in the first two seconds, and a small laugh |
| Turn | −2.6 … −0.5 | "There's a better way." | Permission to care |
| Question | 0 … 3.4 | The product's input draws in and a real question is typed while it is said | Shows the interaction model, not features |
| Answer | 3.4 … ~9 | Pull back to the workspace; data arrives and sorts; the answer types out; the cursor picks the key item | The product does the work |
| Evidence | ~9 … ~22 | Push in on what makes it credible: a score counting up, a map outline drawing, photos with findings, reasons with source chips | Trust |
| Decision | ~22 … ~38 | Compare options (scenarios, plans), pick the recommended one, show the concrete next step | Outcome, not features |
| End card | last ~3 s | Logo plus a line that answers the opening pain | Memory |

Shorter formats keep the same arc:
- **Teaser (15–20 s):** pain, turn, question, one answer beat, end card.
- **Intro/outro sting (4–8 s):** the logo-and-line part only, or a pain-and-turn title pair.

## Timing rules

- **Words, not frames.** Each beat starts on a spoken line. Its first visible change lands within ~0.2 s of the word that names it.
- **Typing takes as long as saying.** Type a question across the same seconds the voice reads it; the typing rhythm comes from the engine.
- **Staggers.** List rows, KPI tiles and chart bars enter 0.04–0.13 s apart. Whole panels enter about 0.15 s apart.
- **Camera moves** take 1–2 s with an in-out ease, and start just *before* the line about the new thing. Hold still while something important animates.
- **Clicks** come about 0.3 s after the cursor arrives. The result appears about 0.1 s after the click.
- **Lead and lag.** Let the picture lead the voice slightly on reveals, and let numbers finish counting as the number is spoken.
- **End card** holds 2–3 s after the last word.

## Worked example: Revitamal "Jak to funguje" (cs, 61 s voice-over)

Story time on the left (seconds); the line that starts there (voice time in brackets) on the right. The source is `revitamal-landing/src/data/how-it-works-soundtrack.ts` and `HowItWorksMotion.astro`.

| Story | Voice line (cs) | On screen |
|---|---|---|
| −6 | „Investiční plán budov v Excelu.“ (0.0) | title card, words rise |
| −4.75 | „Sedmá finální verze…“ (2.6) | `investicni_plan_final_v1…v7.xlsx` counts up |
| −2.7 | „Jde to i jinak!“ (5.25) | turn card |
| −0.55 | „Stačí se zeptat:“ (6.6) | the prompt input draws in |
| 1.25 | „co opravit jako první?“ (7.95) | question typed while it is said |
| 3.4 | „Revitamal seřadí portfolio podle rizika.“ (9.7) | pull back; rows arrive and sort |
| 7.6 | „Nejvíc pozornosti potřebuje tento bytový dům…“ (12.6) | cursor clicks the building |
| 10.1 | „technický stav třicet devět ze sta.“ (17.6) | score counts to 39 |
| 12 | „Ke každé budově propojí satelitní snímky, interní dokumenty, katastr…“ (21.4) | outline and 3D draw on the aerial |
| 12.75 | „…i fotky interiéru a exteriéru…“ (23) | first photo |
| 14.5 | „…a umělá inteligence v nich označí nálezy.“ (27.4) | hold on the marked photo |
| 16.75 | „Proč právě tento dům?“ (29) | follow-up question typed |
| 19.65 | „Copilot to vysvětlí:“ (31.2) | sent |
| 21.6 | „kritický stav střechy, opakované zatékání a rostoucí technický dluh.“ (32.6) | reasons appear one by one |
| 22.7 | „I se zdroji.“ (36.5) | source chips pop |
| 24.2 | „Pak porovnáte rozpočty.“ (37.6) | scenario board |
| 28.2 | „…zůstanou jen dvě rizikové budovy…“ (42.5) | scenario B picked |
| 28.6 | „to je doporučený scénář.“ (44.1) | recommended badge |
| 31 | „A pro každou budovu si zvolíte plán obnovy, třeba na deset let:“ (45.9) | renewal plan |
| 38.4 | „co opravit, kdy a za kolik.“ (51.4) | schedule fills in |
| 38.6 | „První krok… střecha a výtah v roce 2027.“ (51.8) | first-step card |
| 42.1 | „Revitamal.“ (56.05) | end card, logo |
| 42.35 | „Poslední verze vašeho investičního plánu.“ (57.1) | answers the v7 joke |
| 45 | — (61.2) | card holds |

Notice how the story clock runs at its own pace (45 s of story for 61 s of voice). The sync map stretches each stretch of picture to its line, so animation timings never need to be rewritten when the voice changes.

## beats.json for this example (first lines)

```json
{ "language": "cs", "beats": [
  { "story": -6, "say": "Investiční plán budov v Excelu" },
  { "story": -4.75, "say": "Sedmá finální verze" },
  { "story": -2.7, "say": "Jde to i jinak" },
  { "story": -0.55, "say": "Stačí se zeptat" },
  { "story": 1.25, "say": "co opravit jako první" }
] }
```

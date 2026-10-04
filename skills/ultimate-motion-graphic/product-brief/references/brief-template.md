# Product brief template

Write `.claude/product-brief.md` in this shape. Keep it factual and sourced: every value carries the
file path or URL it came from. Mark numbers **real** or **illustrative**.

```markdown
# <Product> — product brief
_Updated <date> from: <sources with paths/URLs>. Confirmed by <person> on <date>._

## In one sentence
<What it does, for whom, in the product's own words.>

## Problem (customer's words)
- <pain> — source: <path/URL>

## Promise
<The outcome it claims; quote the hero headline.>

## Audiences
| Who | What they recognise | Source |
|---|---|---|

## Flows worth showing
| # | Moment | Screen / component | Input → visible output | Source |
|---|---|---|---|---|
| 1 | <e.g. ranks the portfolio by risk> | <view/file> | <question → sorted list> | <path> |

## Proof points
| Claim / number | Real or illustrative | Source |
|---|---|---|

## Words to reuse
- Headlines: …
- UI labels and strings: …
- Taglines / CTAs: …
- Locales shipped: …

## Do not show or say
- …

## Demo data findings
| Finding | Where | Recommendation |
|---|---|---|
| <real address shown with invented defects> | <file:line> | <replace with internal name + illustrative notice> |
| <orthophoto from X needs attribution> | <file> | <credit on the image> |

## Brand kit
### Colour
| Role | Value | Used for | Source |
|---|---|---|---|
| Page | #… | | |
| Surface / panel | #… | | |
| Ink | #… | | |
| Muted | #… | | |
| Line | rgba(…) | | |
| Brand | #… | | |
| Accent / AI gradient | … | | |
| Status good / warn / bad | … | | |

### Type
- Families and files: …
- Weights: …
- Display sizes, line-height, letter-spacing: …
- Headline style: <e.g. two-tone — muted clause + ink clause>

### Shape and depth
- Radii: controls …, cards …, panels …
- Borders and shadows: …

### UI look
- Layout grammar: <rail / list / detail / assistant panel …>
- Density, icon library and stroke, chart style, how AI surfaces are marked: …

### Motion and voice
- Existing motion cues: …
- Voice: <tone, sentence length, formality>

### Tokens (ready to paste)
```css
:root {
  --ink: #…;
  --muted: #…;
  --page: #…;
  --panel: #…;
  --line: rgba(…);
  --brand: #…;
  --accent: #…;
  --font: "…", system-ui, sans-serif;
  --radius: …px;
}
```
```

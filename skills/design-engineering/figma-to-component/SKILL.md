---
name: figma-to-component
description: "Turn an existing Figma design into local component code — read the frame through the Figma MCP, decompose it into dumb presentational components, write one Storybook story file per component, and stop before commit. Use when given a figma.com URL or node-id and asked to implement, build, port or code the design; when asked to \"sync the design to code\"; or when adding a component whose spec lives in Figma. Covers the read-plan-write-verify loop, the reuse-before-create pass, and the token mapping gate."
---

# Figma → component

The design already exists. This skill runs the arrow from **created design → code**:
read it, plan it, write it locally, verify it in Storybook, stop.

Upstream is `prompt-to-figma`, which produces the design and hands off a
file key, node-ids, and a **reused vs net-new** inventory. When that report
exists, read it first: the net-new list is the set of things you are allowed to
create, and everything else should resolve to an existing `@org/ui` component
in STEP 2. When it does not exist (a design someone made by hand), derive the
same two lists yourself in STEP 2 and say so.

## Fixed decisions — do not re-litigate them per run

| Decision | Value |
|---|---|
| Direction | Figma → code only. Never write back to Figma from this skill. |
| Destination | `<ui-package>/src/<area>/<Component>/` unless the user names another workspace. |
| Component shape | **Dumb.** Props in, JSX out. No data fetching, no stores, no routing, no service-layer calls. |
| Tests | Follow the repo's convention for this layer — `.claude/design-profile.md` records it. Where Storybook is the only harness, do not add tests. |
| Stories | One `*.stories.tsx` beside every component. Non-negotiable — a component without a story is not done. |
| Branch | Work in the tree, uncommitted. Do not branch, commit, push or open a PR. |
| Loop-back | Ambiguity in the design goes back to `prompt-to-figma` as a new brief, never resolved by invention. |

Leaving the work uncommitted is deliberate here and is the one place this flow
departs from a "never commit to the default branch" rule — nothing is committed, so the
rule is not broken. If the user later wants it shipped, that is a separate,
explicit step: branch, commit to your repo's message convention, PR, review.

## STEP 0 — Load the house style

Read these **from disk, in this run**, before writing a line. Read them in
parallel; it is one tool call.

| File | Must contribute |
|---|---|
| the `design-components` skill | the variant mechanism, complete per-state binding, the props-vs-`className` call, icon colour |
| the `design-tokens` skill | the token for every colour/radius/font, and the silent-failure traps |
| your repo's conventions file, if it has one | TypeScript rules, composition rules, anything house-specific |

`.claude/design-profile.md` names that last file if `/design-profile` has run.
If your team has its own code-review agents, read whatever they read — code
produced here should pass them without a second pass.

**"It is already in my context" is not a substitute for reading them.** Neither
is having written or edited one earlier in the same session. Context is not
evidence: a rule recalled from memory is a rule that may have drifted, and a run
in a fresh session — which is the normal case — would have none of it. If a file
cannot be read, say so explicitly in STEP 7 and name what you fell back on;
never proceed silently without it.

**Treat each file as a claim to test, not scripture.** These skills describe a
library that moves. Where one states a convention, spot-check it against the
code you are about to sit next to — a rule with nine competing implementations
is a preference, not a convention, and the neighbouring file wins. Report the
discrepancy in STEP 7 so the skill gets fixed; do not silently follow a rule the
library abandoned, and do not silently ignore one it still keeps.

## STEP 1 — Read the design

Never guess from a screenshot alone, and never guess from the snippet alone.

1. `get_metadata` on the frame → the node tree, node ids, and what is a component
   instance vs a raw layer.
2. `get_design_context` per node → **the snippet is authoritative.** Emit what it
   says. Do not replicate styling the snippet omits: a fill visible on canvas but
   absent from the snippet is produced by the component at runtime, and matching
   it with an extra class produces a component that fights itself.
   **A snippet that sizes an element only through absolute insets can be
   wrong.** `aspect-[40/40]` with `top-[16px] bottom-[16px]` reads as 40x40, but
   the node was 20x20 — the emitted CSS describes a box the exporter guessed at.
   Whenever a size comes from insets rather than an explicit width/height, check
   it against `get_metadata`, which reports the node's real dimensions.
3. `get_variable_defs` → the design's variable → value map. This is the input to
   the token gate in STEP 3; without it you are eyeballing hexes.

   Also read what the node is **bound** to, not just what it renders: a text
   node carrying a named style (`label/lg-extrabold`) and a fill bound to
   `color/surface-selected` have already told you the token. `prompt-to-figma`
   binds every value it draws, so a design that comes back with bare hexes was
   either drawn by hand or drifted — say so in STEP 7 rather than mapping the
   hexes silently. A style name your repo has no counterpart for — common where a repo ships raw
`text-[…]` triples and no type scale — is a token request, not a licence to
invent one.

   If the file was **token-primed** (see `prompt-to-figma`
   `references/token-priming.md`), the names that come back are the CSS custom
   properties without their `--`: `card`, `muted-foreground`, `radius-card`. The
   mapping is then a lookup, and STEP 3's token table should be near-mechanical.
   If it was not primed you get raw hexes and must map them by role — pull the
   live token list to map against:

   ```bash
   python3 <path-to>/prompt-to-figma/scripts/extract-tokens.py --css <token-file> --group
   ```
4. `get_screenshot` → save to the scratchpad. This is the reference image for the
   STEP 6 visual check, not a spec to trace.
5. `download_assets` only for real raster/vector assets. An icon that already
   exists in the library's icon directory is a reuse, not a download.

**Enumerate the off-by-default component properties.** The snippet exposes
booleans that are `false` in every variant on the canvas — an optional badge, a
secondary label, a status dot are the usual suspects. They are invisible when you look
at the design and fully specified in the code, so they are easy to either miss
entirely or build by accident. List every one, build none of them, and put them
in STEP 7's questions: a property switched off everywhere is either cut or
missing its default-on variant, and only the designer knows which. Note any that
escape the component's bounds (a badge at `top: -6.5px`) — those interact with
`overflow-hidden` and change the shell, not just the content.

Record the file key and node-id of every node you read — STEP 5 puts them in the
story so the next person can reopen the source.

## STEP 2 — Reuse before you create

**If the repo keeps a component ledger, read it first.** A ledger — a single file
recording what this flow has already built, with each component's path, API,
Figma node and open questions — is worth keeping, because rebuilding something
that already exists is the failure it prevents. Its *not built* section is just
as useful: it records what was deliberately skipped and why, so a decision is not
re-litigated. If there is no ledger, the barrel and the Storybook sidebar are the
next best inventory.

Then grep `<ui-barrel>` and the primitives directory for each piece of the design
before creating anything. A mature library already ships most of what a frame
needs — accordion, avatar, badge, button, card, checkbox, dialog, drawer, input,
popover, select, table, tabs, tooltip and so on. `/design-profile` names the
barrel; read it rather than assuming what is in it.

A Figma frame that draws its own button is a designer detaching an instance, not
a request for a second Button. Compose the existing primitive; if it genuinely
cannot express the design, say which prop or variant is missing and propose
adding it to the primitive rather than forking it.

Re-implementing a Radix-backed primitive by hand is a rejected outcome.

## STEP 3 — Plan, and gate on it

Write the plan to the scratchpad and show it. Do not write source until the user
confirms. The plan is four tables:

**1. Component inventory** — one row per component you intend to create:
name, file path, one-line responsibility, and whether it is a leaf or composes
others. Split by responsibility, not by Figma layer depth; a Figma group is not
a component boundary.

**2. Props** — per component: prop, type, required, default. Every prop is
presentational. If a prop smells like state (`isLoading`, `error`, `data`) it is
a prop *of this dumb component*, supplied by a future container — the container
is explicitly out of scope.

**A Figma variant axis is not automatically a prop.** Sort each axis into one of
three piles before writing the table:

| Axis is really… | Goes to |
|---|---|
| available width (`Device=Desktop/Mobile`) | CSS — a container query, not a prop |
| data about the record being rendered (its type, its category) | a prop |
| a rendering of another prop (`Align=Left/Center`) | neither — derive it |

Figma has no responsive primitive, so designers encode viewport as a variant.
Copying that axis into the component API imports the tool's limitation into the
code. Watch for axes that look like one thing and are another: a set with
`Device=Mobile (Compact)` alongside `Device=Mobile` is not two devices, it is a
content mode — data, wearing a device label. Getting that wrong produces
a `layout` prop that no caller can set correctly.

See `design-components` §Responsive for the container-query mechanics, the
circularity trap for fixed-size elements, and what rendering both shapes does to
the API.

**3. Token mapping** — every colour, radius, spacing and type value in the
design, mapped to a CSS custom property from the repo's token file.
Three outcomes per row, and each row must land on one:
   - maps to an existing token → use it
   - near-miss on an existing token (ΔE small, same role) → propose the existing
     token, flag the divergence in the plan
   - genuinely new → **stop and ask.** A new token is a token-file change with a
     sync obligation across token files (see `design-tokens`), not a hex literal in a
     component. Never invent a token silently, never inline the hex.

**4. Stories** — per component, the story list: one per variant and per
meaningful state, named for what it shows.

If the design contradicts itself (two paddings for the same slot, a state with no
spec, text that overflows its frame at the widths shown), the plan says so and
the loop goes back to the designer. Implementing an inconsistency freezes it.

## STEP 4 — Write the components

Layout, matching the rest of `@org/ui`:

```
<ui-package>/src/<area>/<Component>/
  <Component>.tsx
  <Component>.stories.tsx
```

Then export it from `<ui-barrel>`, matching however that file is organised.

Rules that bite in a Tailwind + CSS-custom-property setup:

- The repo's own variant mechanism for anything with variants, and its own
  class-merging helper — confirm both are already dependencies before importing.
- Tokens via `bg-[var(--card)]`, `text-[var(--muted-foreground)]`. No hex.
- Font family needs the type hint: `font-[family-name:var(--font-sans)]`.
  Plain `font-[var(--font-sans)]` emits no rule in Tailwind v4.
- **Check the root font-size before trusting rem-based utilities.** If `html`
  is not 16px, every rem-derived class is a different number of pixels than its
  name suggests. Write absolute px (`h-[40px]`) where the design specifies px. This applies to negative margins
  too — on a 14px root, `-mb-1` is 3.5px, not 4px.
- **A negative margin or an odd 3px padding in the snippet is a decision, not an
  artifact.** `mb-[-4px]` on a 12px label in a 20px line box is cancelling
  half-leading so the line below sits tight; drop it and the gap is visibly
  wrong. Reproduce these, or verify the rendered gap against the Figma render
  before deciding you know better. Reconstructing layout in the system's own
  primitives applies to *structure* — absolute positioning, stacked frames — not
  to the designer's optical corrections.
- Whatever TypeScript strictness the repo enforces — read its tsconfig rather
  than assuming.
- Branch discriminated unions exhaustively, however the repo does it.
- No exported className constants — classes go inline in JSX, variants are props.
- No explanatory comments. The Figma node reference belongs in the story's
  docblock (STEP 5), where it stays accurate.
- If the component pulls in a workspace package the consuming app did not use
  before, check whether that app needs to be told about it — a transpile list, a
  Tailwind `@source` line, a build allowlist. These fail silently: lint,
  typecheck and tests all pass while the page is broken in the browser.

## STEP 5 — One story file per component

The story is the spec, the review surface and the only harness. Match the
existing convention exactly:

```tsx
import type { Meta, StoryObj } from "@storybook/react";  // match the repo's framework package

import { SummaryCard } from "./SummaryCard";

/**
 * Source: Figma `<file-key>` node `<node-id>` — <frame name>.
 * <One paragraph on what this component is for and where it appears.>
 */
const meta: Meta<typeof SummaryCard> = {
  title: "<Area>/SummaryCard",
  component: SummaryCard,
  parameters: { layout: "centered" },
};
export default meta;

type Story = StoryObj<typeof SummaryCard>;

export const Default: Story = { args: { … } };
```

- `title` follows the area the file lives in: `Primitives/…`, `Icons/…`,
  `<Area>/…`. Match the roots already in use — `/design-profile` lists them.
- Story ids are `kebab(title)--kebab(exportName)` and if the repo runs a visual-diff
  pipeline it will reference those ids, so renaming an export can break it.
- `argTypes` with `control: "radio"` for each variant/size union, so a reviewer
  can drive the whole matrix without editing code.
- One story per variant and per state that renders differently. Hover, focus and
  active render the same markup — they do not each need a story; disabled, empty,
  loading, overflow and error do.
- **Check the global decorators before debugging a story that looks wrong.** If
  Storybook wraps every story in a decorator — a tight crop for a visual-diff
  script is the usual reason — a component sized `w-full` can resolve against a
  zero-width parent and collapse into a sliver. Nothing errors; the story just
  renders wrong, and at a glance it reads as a broken component rather than a
  broken wrapper. Read `.storybook/preview.*` before assuming the component is at
  fault, and use whatever per-story escape hatch that decorator provides.
- **A component with a container-query contract gets stories that supply the
  container** — one per shape, with the cell width in the story name or a label.
  A story that forgets the `@container` ancestor silently shows one shape only,
  and the other shape ships unreviewed.
- **Every text field fed by real data gets an overflow story**, with a realistic
  worst case — the longest real string, not the placeholder. The design will not specify
  this: Figma frames are built with short placeholder strings, so the overflow
  behaviour has never been seen by anyone. Assume it is missing, decide it, and
  say in STEP 7 that you decided it.
- Anything portaled (menu, popover, tooltip, modal) needs a story where it is
  **open**, or the surface that actually matters is never rendered.
- **Where a global decorator shrink-wraps stories, a full-width component needs
  the escape hatch on the META, not just on stories that set an explicit width.**
  A decorator wrapping every story in `display: inline-block` shrink-wraps a
  `w-full` root to zero width. Nothing errors — the component simply renders in
  its narrowest container-query shape forever, which reads as "the breakpoint is
  broken". Args-based stories are where this bites, because render-based ones
  usually set a width already. Measure `getBoundingClientRect().width` on the
  root before believing a responsive bug.
- `parameters` and `tags` must be inline literals on the export. The Storybook
  indexer parses the file rather than executing it, so a spread `tags` is ignored
  and the story leaks into everyone's sidebar. `args` may spread — that
  asymmetry is confusing and deliberate; leave it alone.
- Tests follow the repo's convention for this layer, not this skill's preference.

## STEP 6 — Verify

```bash
<check-cmd>        # typecheck + lint for the shared package
<storybook-cmd>    # start Storybook and look at what you built
```

`<check-cmd>` comes from `.claude/design-profile.md`; take `<storybook-cmd>`
from the package's own `package.json` scripts. If it has not run, get them from the
package's own `package.json` scripts rather than guessing at a task runner.

Then compare each story against the STEP 1 screenshot at the same width. What you
are looking for is structural: wrong spacing scale, a token that reads too light,
text that wraps where the design does not, a state you did not build. Do not add
classes to close a gap the snippet did not specify — that is the loop-back
signal, not a code problem.

**When something looks off, measure it — do not argue from the screenshot.**
Render the Figma node and the built story at the same size and compare the pixels
(glyph bottom rows for baselines, column bands for spacing). See
[`references/visual-verification.md`](references/visual-verification.md) for the
procedure and the working snippets, including the Playwright traps that cost time
every run.

Measuring settles the question that matters: **is this difference mine or the
design's?** A 1px baseline offset between text of different sizes is almost
always the design's — `items-center` aligns boxes, not baselines, in Figma
exactly as in CSS. Reproducing it is correct; silently "fixing" it is a
divergence nobody asked for and it comes back on the next port.

Run nothing else. Whether this layer carries tests is a repo convention, not a
rule this skill sets — `.claude/design-profile.md` records what yours does. Where
the shared package uses Storybook as its only harness, do not add tests to it.

## STEP 7 — Report and stop

Report, in this order:

1. **House-style attestation** — one line per STEP 0 file: read or not read, and
   the specific rule it changed in this component (or "no applicable rule").
   A file you cannot point to a concrete effect from is a file you did not really
   apply. Name any convention that turned out not to hold in the code.
2. Files created, grouped by component.
3. Barrel exports added.
4. The token mapping as built, with every divergence and every new-token request
   called out separately — this is the part a reviewer must actually read.
5. Anything the design left ambiguous, phrased as a question for the designer.
6. The Storybook URL for each new story.
7. **The ledger updated, if the repo keeps one** — append or amend this
   component's entry: path, export, story, Figma node ids, the API, what a
   container must supply to wire it, overlaps with existing components,
   deliberate divergences, and the open design questions. This is the handoff to
   whoever builds the real page; a component recorded nowhere is a component
   the next session will rebuild.

Then stop. No commit, no branch, no PR, no review run. The user drives the
next loop — either back to Figma for the ambiguities, or forward to a branch.

**The loop back is a brief, not a bug report.** An unanswerable design question
(a state with no spec, two paddings for the same slot, copy that overflows at a
real width) goes to `prompt-to-figma` phrased as what the design needs to
show. Do not park it in a TODO comment and do not pick a value: an invented value
is indistinguishable from a specified one the moment it is committed.

**Forward is deliberate and separate.** If the user wants this shipped, that is
your repo's full review gate order — branch, test-first, preflight, PR, review,
merge. This skill deliberately produces none of it; a dumb component with stories is where it stops.

## Checklist

- [ ] Every STEP 0 file read from disk this run; each attested in the report.
- [ ] Snippet read via `get_design_context`; nothing styled that the snippet omits.
- [ ] Existing `@org/ui` primitives reused; nothing re-implemented.
- [ ] Plan confirmed before the first source file.
- [ ] Every value maps to a token; no hex literal, no silently-invented token.
- [ ] Off-by-default component properties enumerated, none built, all questioned.
- [ ] Optical corrections from the snippet reproduced, or their absence verified.
- [ ] Every data-fed text field has an overflow story with a realistic worst case.
- [ ] Every component has a story; the layer's testing convention respected.
- [ ] Portaled surfaces have an open story.
- [ ] `typecheck` and `lint` green on `@org/ui`.
- [ ] Existing inventory checked before creating anything (ledger, barrel or sidebar).
- [ ] Nothing committed.

---
name: prompt-to-figma
description: Create a Figma design from a terminal prompt or a hand-drawn sketch, or sync a component that already ships in code into Figma, built from the repo's live design tokens, and hand off a file key plus node-ids that figma-to-component can implement. Use when asked to design, mock up, sketch out, explore or lay out a screen, flow or component that does not exist yet; when an image of a drawing or wireframe is attached and turned into a real design; when asked to push a built component's states into Figma; when iterating after a design review; or when a coding pass came back with a question the design has to answer. Composition is free-form; colour, radius, type and spacing come from the repo's token file.
---

# Prompt → Figma

Stage one of the design→code flow. Produces a **design**, not code. Its output is
the input to `figma-to-component`.

## Three entry points, one rule

| Input | What it gives you |
|---|---|
| **A prompt** typed in the terminal | Intent, and nothing else. The brief has to be built (STEP 1a). |
| **A sketch** — screenshot, photo of a whiteboard, Excalidraw export, wireframe — plus a prompt | Layout and hierarchy. **Not** a visual spec (STEP 1b). |
| **A component that already ships** — "put the SummaryCard's states in Figma" | The spec, already settled. Read it from source (STEP 1c); invent nothing. |

The rule that applies to all three: **composition is free-form, values are not.**
Arrange the screen however the work needs. Every colour, radius, font and size
comes from the live token file. A hex that is not in that file is a token
request, raised in the handoff — never a value quietly invented on the canvas,
because the implementation step cannot tell an invented value from a specified
one, and will faithfully reproduce the mistake.

## STEP 0 — Load the Figma authoring rules

`use_figma` has a mandatory companion skill. Load `/figma-use` if the Figma
plugin is installed; otherwise read the MCP resource
`skill://figma/figma-use/SKILL.md`. Do not call `use_figma` before it is loaded.
FigJam work uses `/figma-use-figjam` and `generate_diagram` instead.

## STEP 1a — From a prompt: sharpen it before drawing

A one-line prompt produces a design that loops three times. Spend one exchange
turning it into a brief, and write down what you assumed so it can be corrected:

- **Scope** — one component, one screen, or a flow?
- **Where it lives** — which app or package, and where inside it. Placement
  drives width and surrounding chrome.
- **Who is looking** — end user or administrator. Different affordances.
- **States** — the ones the screen genuinely has: empty, loading, error, long
  content, disabled, permission-denied, post-deadline. **Name them now.** The
  code step builds one story per state and will come back asking otherwise.
- **Breakpoints** — mobile and desktop at minimum; check where your traffic
  actually is before assuming desktop-first.
- **Content realism** — real names, real values, plausibly long
  usernames. Lorem ipsum hides every layout bug worth catching at design time.

Ask only about what materially changes the design. Assume the rest, in writing.

## STEP 1b — From a sketch: read it as intent, not as pixels

Read the image. Then state back, in words, what you took from it — regions and
their order, hierarchy, what repeats, what is interactive, what text is real copy
versus placeholder scribble. Get that confirmed before drawing. A
misread sketch produces a confident, wrong design faster than anything else in
this flow.

**A sketch specifies structure. It does not specify appearance.** Its greys,
gaps, corner radii and handwriting carry no information — they are the limits of
a pen, not decisions. Do not measure them, do not sample them. Layout comes from
the sketch; every value comes from the tokens.

Sketches are also silent about the things that cost the most later, so ask:

- which states exist beyond the one drawn
- what happens at mobile width if the sketch is clearly desktop
- whether a repeated row is a list (unbounded, needs empty and overflow states)
  or a fixed set
- what the scribbled copy actually says

If the sketch and the prompt disagree, the prompt wins — and say that you noticed.

## STEP 1c — From code: the component is the brief

Nothing here is a judgement call, so do not treat it as one. Open the component
and read the spec off it:

- **Every state**, from the union that drives it — a `cva` variant map, a
  `ts-pattern` match, a discriminated prop. The board draws all of them, named
  exactly as the union names them (`selected`, not "active").
- **Every shape** the responsive classes produce. A `@[1100px]:` prefix is a
  second frame, not a note.
- **Every content variant** the props allow — an optional field is a frame:
  present, absent, and overflowing.
- **The values**, from the classes: `h-[36px]`, `rounded-[10px]`,
  `text-[14px] leading-[20px] font-extrabold`. These are the design; do not
  re-derive them from a screenshot.

A `color-mix()` resolves to one value on the canvas — compute it, and list it in
STEP 7 as a token the code expresses as arithmetic and Figma cannot.

## STEP 2 — Pull the live tokens

`.claude/design-profile.md` names the token file. If `/design-profile` has not
run, run it first rather than guessing where the tokens live.

Run this from the repo root every time. Never draw from remembered values; the
token file moves.

```bash
python3 <skill-dir>/scripts/extract-tokens.py --css <token-file> --group
```

Read what comes back rather than assuming a shape. A mature token file usually
has brand and surface colours, a grade family (success/error/info/warning with
`-text`, `-fill`, `-surface`, `-border` siblings), a radius set named for what it
wraps, a spacing scale, and one or two type families.

Drawing rules that follow from the file:

- **Pick by role, not by hex.** `--muted-foreground` is "secondary text on a
  light surface". Choose the token whose role matches, then use its value.
- **The grade families are contrast work.** `--color-danger`,
  `--color-danger-text`, `--color-danger-fill` and `--color-danger-text-strong` are
  four values for four different backgrounds, not four reds to taste. Read the
  comment beside the token before choosing.
- **Use the type families the token file declares.** Most brands allow one,
  sometimes two; a third typeface on a board is a question for the designer, not
  a choice. Check the root font-size: where it is not 16px, designs must specify
  px rather than rem-derived utilities.
- **Spacing in the design should land on 4/8/12/16/24/32.** A 13px gap is a
  transcription error that becomes `gap-[13px]` in code and lives forever.
- **Need a value that has no token?** Draw it, and put it on the token-request
  list in STEP 7. That list is the design's contribution to the token file.

## STEP 3 — Target file, and whether to prime it

Ask for an existing Figma file (URL or key) to draw into; if there is none,
`create_new_file`, named for the work rather than the date.

For any file that will be implemented more than once, prime it with the tokens as
Figma **variables** first — then drawing binds to variables, and the code step's
token mapping becomes a lookup instead of a judgement call. See
[`references/token-priming.md`](references/token-priming.md) for the plan/write
split, the naming contract, and the three token shapes that need
care (`color-mix()`, `var()` aliases, shadows).

Skip priming for a one-off exploration. Draw with the values from STEP 2 and note
in the handoff that the file is unprimed, so the code step knows it is mapping
hexes rather than reading names.

**Iterate in place across loops.** When a review sends you back, rename and edit
the existing nodes rather than deleting and recreating them: a node ID is what
every instance, comment and handoff reference points at. `delete + recreate`
unbinds all of it silently, and the file still looks right the day you do it.

## STEP 4 — Reconnaissance, and why it is not optional

The expensive failure in this flow is not a wrong colour. It is **minting a
second name for something the design system already names** — `label/lg-extrabold`
next to the `Subhead/Small XBold` that was there all along. Every later reader
now has to know both. Spend the two minutes.

**The three probes that lie to you.** Each returns empty in a healthy file:

| Probe | Empty means |
|---|---|
| `getLocalTextStylesAsync()` / `getLocalPaintStylesAsync()` | Only that **this file** defines none. A file consuming a library has none of its own — the styles are remote. |
| `getAvailableLibraryVariableCollectionsAsync()` | Only that no **variables** are published. A library can publish styles and no variables, which is the common older shape. |
| `search_design_system` for a term you invented | Only that the library does not use **your** word. It says nothing about whether the thing exists under its own. "subtitle" finds nothing in a system whose scale is called "Subhead". |

**The probe that does not.** Open a node a designer actually made and read what
it is bound to:

```js
// per TEXT node: the real style name, exactly as the system spells it
await figma.getStyleByIdAsync(node.textStyleId)   // → "Subhead/Small XBold"
await figma.getStyleByIdAsync(node.fillStyleId)   // → "Grey/7"
await figma.variables.getVariableByIdAsync(node.fills[0].boundVariables.color.id)
```

One frame from the product file hands you the whole vocabulary — type scale,
colour ramp, radius names — spelled the way the team spells it. Do this **before**
`createTextStyle` or `createVariable` ever crosses your mind. Where the design
lives in a different file from the one you are drawing in, read there and import
here (`importStyleByKeyAsync`, `importVariableByKeyAsync`).

**Then: does the component already exist?** `search_design_system` with
`entity: "component"`. If it does, the board is **instances of it**, not a
redraw:

```js
const set = await figma.importComponentSetByKeyAsync(key);
const variant = set.children.find((c) => c.name === "Device=Mobile, Type=Primary, State=Selected");
const instance = variant.createInstance();
```

A redraw of an existing component is drift that reads as reuse — the most
expensive thing this skill can produce, because it looks correct in review.

**Say which kind of empty you hit.** "There is no published type scale" and "I
could not reach the published type scale" send the next person to different
places; the handoff must distinguish them.

## STEP 5 — Build

Follow `/figma-use`. Five things matter specifically because this becomes code:

1. **Reuse before you draw.** An existing component becomes instances with
   variant props set; an existing style gets imported and applied. You create a
   style or variable only after STEP 4 proved the system has none — and when you
   do, you say so in the handoff as a naming proposal, not a fact.

2. **Bind, never paint.** Every fill, stroke, text colour, radius and fixed size
   resolves to a **named** Figma variable or text style — `setBoundVariableForPaint`
   and `setTextStyleIdAsync`, not a literal on the node. A raw `{r, g, b}` on a
   frame is the same defect as a hex in a component: it reads as a decision when
   it is a transcription, and the next person cannot tell which token it came
   from. **The name is the contract** — a Figma variable is named for the CSS
   custom property it carries (`--surface-selected` → `color/surface-selected`), so the code
   step's token mapping is a lookup rather than a colour match.
   - Values the code computes (`color-mix()`) get a `derived/` variable named for
     the role, and a line in the STEP 7 token requests.
   - Where the code has **no** name for something the design must name anyway —
     a repo with no type scale, only raw `text-[14px] leading-[20px]` triples, is
     the common case — create the style, name it for its role in the scale (`label/lg-extrabold`),
     apply it to every node sharing that triple, and raise the naming as a token
     request. One style per triple, never one per element, or the library grows a
     synonym for every place a size is used.
3. **Layer names become component names.** `SummaryCard`, not `Frame 428`.
   Otherwise the implementation invents names nobody uses in standup.
4. **Draw every state** named in STEP 1, as labelled sibling frames. A state that
   exists only in a comment does not reach the code.
5. **Auto-layout anything that grows.** A fixed-size frame holding text is a
   layout the code cannot reproduce, because the code will wrap where the design
   cannot. Note that resizing an auto-layout frame forces that axis to fixed
   sizing — set hug/fill *after* any resize, or content that grows later
   overflows a too-short frame.

## Working with someone else's component

Instancing a real component is the right answer and it has three sharp edges.

**`setProperties` rebuilds the instance's subtree.** Node IDs you collected by
walking it beforehand are dead the moment you set a property — `The node with id
"…" does not exist`. Collect only the **top-level** instances (the ones carrying
the `Device`/`Type`/`State` variant props), and re-fetch each by id inside the
loop rather than holding node references across mutations.

**A component can leave its own layers unbound.** Setting a text property and seeing
the placeholder still on the canvas is not your bug: that variant's text layer was never wired to
the property. Override the layer on the instance — load the node's *current*
fonts via `getStyledTextSegments(['fontName'])` first — and **list every override
in the handoff**. That list is a defect report for the component, and it is the
most useful thing the sync produces.

**A state the code has and the variant set does not is a finding, not a blocker.**
Draw the nearest variant, label it with the code's name, and put the gap in the
handoff. The reverse — a variant the code collapses, like three live states
flattened into one — is the same finding pointing the other way, and matters more:
the design already drew a distinction the implementation is throwing away.

## STEP 6 — Review it against the brief yourself

`get_screenshot` each frame and check before showing the user:

- a state from the brief that never got drawn
- text that overflows at mobile width
- two spacings that should be equal and are not
- a value that is not a token, or a token that is not bound — check the canvas,
  not your intent: `node.fills[0].boundVariables` and `node.textStyleId` are
  empty on anything you painted by hand
- an element that looks like an existing design-system component but is subtly
  different — the most expensive kind of drift, because it reads as reuse

Fix what is clearly wrong. Report what is a judgement call.

## STEP 7 — Hand off

The report is the contract with the next stage. Six things, every time:

1. **Figma URL + file key**, and whether the file is token-primed.
2. **Node-id per frame**, labelled by what it is and which state it shows.
3. **Reused vs net-new** — two explicit lists. The net-new list is what the
   implementation step is allowed to create; every entry is implicitly the
   question "should this become a shared primitive?". A component you instanced
   is reuse; a style you created because the system had none is net-new **and** a
   naming proposal someone has to accept or overrule.
4. **Token requests** — values drawn that have no token, with the role each one
   plays. This is a token-file decision, routed through `design-tokens`.
5. **Assumptions** from STEP 1 that were never confirmed.
6. **Open questions** the design could not settle.

Then stop. Implementation is `figma-to-component`, invoked separately with
the file key and node-ids from this report.

## The loop

Two arrows come back here, and they mean different things:

- **Design review loop** — the design does not match the intent. Refine the
  brief, edit the existing nodes in place, re-run STEP 6. Cheap; expect several.
- **Implementation loop** — the coding step hit something the design cannot
  answer: a state with no spec, two paddings for the same slot, copy that
  overflows at a real width. That comes back here as a new brief. It is never
  resolved by inventing a value in the component.

Record what changed and why on each loop. A design file with no history of its
decisions gets re-litigated every time a new person opens it.

## Checklist

- [ ] `/figma-use` loaded before any `use_figma` call.
- [ ] Sketch read back in words and confirmed before drawing.
- [ ] Brief sharpened; assumptions written down.
- [ ] Tokens pulled live from the token file this run — not from memory.
- [ ] Every colour, radius and size is a token value, or on the request list.
- [ ] Every one of them is **bound** to a named variable or text style, not painted.
- [ ] A real node from the product file read for its style/variable names before
      anything was created — an empty `getLocal*StylesAsync` is not evidence.
- [ ] `search_design_system` asked for the **component** too; if it exists, the
      board is instances of it.
- [ ] Every style or variable created is listed in the handoff as a proposal.
- [ ] Every instance override is listed as a component defect.
- [ ] Every state named in the brief is drawn as a labelled frame.
- [ ] Layer names are the names the components will have.
- [ ] Auto-layout on anything that grows; hug/fill set after resizing.
- [ ] Iterated in place — nothing deleted and recreated.
- [ ] Handoff lists node-ids, reused vs net-new, token requests, assumptions, questions.

---
name: des-eng
description: "End-to-end design flow: discover a component's real states from the code, build them in Storybook, mirror them in Figma, then wire them to the business logic — stopping for approval between every stage. Trigger when asked to add or change a UI surface across design and code together, e.g. '/des-eng <figma-url> add the confirmation dialog for checkout'."
disable-model-invocation: false
---

# /des-eng — code ↔ Storybook ↔ Figma, gated

Four gated stages, bracketed by a read-the-ask step and a hard stop. This flow
adds the two things a design-to-code skill usually skips: **state discovery from the running code**, and **wiring the
finished component to real business logic**.

## Before the first run

This skill needs four facts about your repo: where shared components live, the
barrel to grep before creating anything, the command that typechecks and lints
that package, and your conventions file if you have one.

**Read `.claude/design-profile.md`.** If it exists, those facts are in it —
along with the token vocabulary, the story-title roots and the testing
convention. If it does not exist, run **`/design-profile`** first; it probes the
repo, confirms the ambiguous parts with you, and writes the file. It takes a
minute and it is the difference between this flow fitting your repo and this
flow guessing at it.

Placeholders below (`<ui-package>`, `<ui-barrel>`, `<check-cmd>`,
`<conventions>`) all resolve from that profile.

## Why this is a skill and not an agent

Every stage ends in a human gate. A subagent cannot stop and ask — it reports
once, at the end — so a `/des-eng` subagent would sail through the gates and
hand back a finished board built on a misread brief. This skill therefore runs
**in the main thread**, and delegates to subagents only for read-heavy work with
no judgement in it (see [Delegation](#delegation)).

## The contract that makes the whole thing checkable

**A Storybook story export and its Figma frame share a name.** If the export is
`SavedWithWarnings`, the frame is `SavedWithWarnings`. Nothing enforces this, so
the skill does: every frame it draws is named for the export it mirrors, and it
reports any pre-existing frame that isn't.

Corollary: **Storybook is the source of truth for what states exist.** Not the
Figma board, not a screenshot, not memory.

## STAGE 0 — Read the ask

First check that `.claude/design-profile.md` exists; if not, run
`/design-profile` before going further.

Then, three things. Ask for whatever is missing; do not guess:

- **The Figma page URL** (with `node-id`) — where frames get drawn.
- **What to build** — "the save dialog", "the summary card".
- **Which app or package owns it.**

Then state back, in two or three lines, what you understood. Cheapest gate in
the flow.

## STAGE 1 — Discover the states from the code

**The reachable state set is a property of the app, not of the design.** A shared
component may offer eight variants while the surface you are building can reach
four, because a prop is hard-coded off, an adapter drops a field, or this surface
simply lacks the capability. Drawing the other four is drawing fiction — and it
is convincing fiction, because it looks exactly like the real thing.

Sweep for:

- the union or variant map that drives the component, if one already ships
- what the relevant mutation's success and failure paths can actually produce
- the guards that make a branch unreachable *here* — a hard-coded prop, a field
  the adapter drops, a capability this surface lacks
- optional props and nullable fields — each is a state: present, absent, and
  overflowing
- responsive shapes: a container-query or breakpoint prefix is a second frame,
  not a note
- the empty, loading, error, disabled and read-only cases

Produce a table: **state → reachable? → evidence (`file:line`)**. Unreachable
states stay in the table with the reason, because "we checked and it can't
happen" is the useful half of the answer.

Watch for two traps worth naming explicitly:

- **A union whose arms the view model collapses.** If five wire values all map to
  one rendered look, that is one state, not five. No story can distinguish them.
- **A type nothing reads.** A tidy union with its own spec file may have no
  consumer on the render path. Build stories from the actual branches, not from
  the type that looks authoritative.

### ◆ GATE 1 — the state list

Show the table. Ask explicitly whether any state is missing or any "unreachable"
call is wrong. **Nothing is drawn or written until this is confirmed** — every
later stage is sized by this list.

## STAGE 2 — Storybook

- **Reuse first.** Grep `<ui-barrel>` before creating anything; a variant of an
  existing component is props, not a fork. Re-implementing a headless primitive
  by hand is a rejected outcome.
- Components are **dumb**: props in, JSX out. No fetching, no stores, no routing.
- **One story per state from STAGE 1**, named so the Figma frame can match.
- Portaled surfaces (dialog, drawer, popover) need a story where they are open.
- Design tokens only — no hex literals. A value with no token **stops the flow**
  and is raised, never inlined.
- Follow the repo's own testing convention for this layer, whatever it is. If
  the shared package uses Storybook as its only harness, do not add tests to it.

Then run `<check-cmd>`.

### ◆ GATE 2 — the stories

Give the Storybook URL per story and say which states they cover. Ask for copy
corrections **here**, before Figma — copy fixed after the board is drawn costs
three edits instead of one.

## STAGE 3 — Figma

Load the Figma plugin-API skill (`/figma-use`, or the MCP resource
`skill://figma/figma-use/SKILL.md`) before any `use_figma` call. On top of it:

- **Frame name == story export name.** Exactly. This is the contract.
- Pull design tokens **live** from the source of truth this run — never from
  memory, never from an earlier conversation.
- Values the code computes (a `color-mix()`, a derived shade) resolve to one
  value on canvas. Compute them and say so; Figma cannot express the arithmetic.
- Search the design system for the component first; if it exists, the board is
  **instances**, not a redraw. Note anything that had to be redrawn because it
  isn't published — that list is the highest-leverage thing this flow produces.
- **Iterate in place.** Rename and edit existing nodes; never delete-and-
  recreate. A node id is what every instance, comment and handoff reference
  points at.
- Screenshot every frame before showing it.

### ◆ GATE 3 — the board

Post the screenshots and the node-ids. Report drift found on the way: any
existing frame whose name doesn't match its story export, and any state on the
board that STAGE 1 found unreachable. State plainly what is representative
rather than reproduced — placeholder art, unmeasured spacing, runtime behaviours
like sticky columns or scroll that a static frame cannot show.

## STAGE 4 — Wire it to the business logic

Now, and only now, the app. Ordinary feature work under `<conventions>`:

- **Branch first**, never the default branch.
- **Test-first** — write the failing test, confirm it is red, then implement.
- Derivation logic goes in its own module as a pure function with its own spec,
  not inline in the view.
- Preflight the owning workspace **and every workspace that consumes a shared
  package you touched**.
- Sweep your own work before handing it over: every "never/always/only" claim in
  a comment is literally true at HEAD; every fix is applied to its structural
  twins; no drafting narration, plan tokens or review citations left in the code.

If wiring reveals a state STAGE 1 missed, **go back to GATE 1** with it. Do not
resolve it by inventing a value or quietly adding a story.

### ◆ GATE 4 — the diff

Summarise what changed, the preflight numbers, and anything deliberately left
out. Then **stop.**

## STAGE 5 — Stop

Do not commit, push, or open a PR unless asked. Shipping is a separate, explicit
decision.

## Delegation

Main thread keeps every judgement call. Subagents take read-heavy work whose
output is a conclusion, not a dump:

| Delegate | Keep in the main thread |
|---|---|
| Figma board recon (node ids, frame names, bound styles) | Building the brief |
| Codebase sweeps for state evidence | Deciding which states are reachable |
| Storybook ↔ Figma name diffing | Drawing and editing frames |
| Prior-PR and git-history context | Every gate |

A board's node tree is thousands of tokens of JSON to find six ids — that is
exactly what a subagent is for. Ask it for the inventory, not the tree.

Verify a delegated conclusion before you act on it. A sweep that reports a file
is unparseable, a field is optional, or a state is unreachable is a claim; the
cheap check that confirms it is usually one command.

## Redirect

A gate can come back "no". That is not an error, it is the flow working. Route
it to the stage that owns the question:

- wrong states → STAGE 1
- wrong copy or missing story → STAGE 2
- wrong visuals or naming → STAGE 3
- wrong behaviour → STAGE 4

Never resolve a design question by inventing a value in the component. An
invented value is indistinguishable from a specified one the moment it is
committed.

## Checklist

- [ ] `.claude/design-profile.md` read, or `/design-profile` run first.
- [ ] Figma URL, what to build, and owning workspace all known — not guessed.
- [ ] States discovered from code, each with `file:line` evidence.
- [ ] Unreachable states listed with the reason they can't happen.
- [ ] GATE 1 confirmed before anything was drawn or written.
- [ ] Existing primitives reused; nothing re-implemented.
- [ ] One story per reachable state; the layer's testing convention respected.
- [ ] GATE 2 confirmed before Figma was touched.
- [ ] Figma plugin-API skill loaded before any `use_figma` call.
- [ ] Tokens pulled live this run.
- [ ] Every frame named exactly for its story export; drift reported.
- [ ] Iterated in place — nothing deleted and recreated.
- [ ] GATE 3 confirmed before the app was wired.
- [ ] App work branched, test-first, preflight green on every consuming workspace.
- [ ] Nothing committed or pushed.

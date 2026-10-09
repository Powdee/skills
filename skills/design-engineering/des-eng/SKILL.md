---
name: des-eng
description: "Design and implement UI across code, Storybook, and Figma from discovery through implementation and validation without routine approval pauses. Use for UI work spanning design and code, or to implement changes from selected Figma frames in an existing app. For an edited Figma design, use implement-Figma-changes mode to preserve the source design while updating the implementation."
disable-model-invocation: false
---

# /des-eng — code ↔ Storybook ↔ Figma

Complete the applicable stages in one continuous workflow. This flow includes **state discovery from the running code**, and **wiring the
finished component to real business logic**.

## Choose the direction

When the request says **Mode: implement Figma changes**, asks to implement an
edited Figma selection, or comes from the Send to Codex plugin, read
[Implement Figma changes](references/implement-figma-changes.md) and follow that
mode instead of the numbered stages below. It keeps the source Figma selection
as the visual target while implementing and validating the changes without redrawing it.

For other design-and-code work, follow the original workflow below.

## Before the first run

This skill needs four facts about your repo: where shared components live, the
barrel to grep before creating anything, the command that typechecks and lints
that package, and your conventions file if you have one.

**Read `.claude/design-profile.md`.** If it exists, those facts are in it —
along with the token vocabulary, the story-title roots and the testing
convention. If it does not exist, run **`/design-profile`** first; it probes the
repo and writes the file. Infer routine choices from repository evidence and
record assumptions; ask only for essential information that cannot be inferred.

Placeholders below (`<ui-package>`, `<ui-barrel>`, `<check-cmd>`,
`<conventions>`) all resolve from that profile.

## Storybook availability

Check the owning package and any shared workspace harness for an existing
Storybook setup (configuration, package scripts/dependencies, and stories).
If Storybook is absent, skip all Storybook work and the stories checkpoint:
do not install or initialize it, create stories, run Storybook commands, or
require story URLs or story-to-Figma name matching. Mark those checklist items
as not applicable. A configured but broken or stopped Storybook is not absent.

Keep component implementation, state discovery, token reuse, and the repo's
normal checks. Verify reachable states through the running app or its existing
preview/test harness, and use the code-backed state table for state coverage
and Figma frame names. This rule applies to both workflow modes below.

## Execution mode

Proceed through discovery, components, stories, applicable Figma work, integration,
and validation without asking for scope, copy, visual, or stage-completion approval.
Checkpoints are self-checks and progress updates, not requests to wait for a reply.
Apply the same approach to routine review pauses in companion design skills.

Resolve routine choices from repository conventions and the supplied design,
record material assumptions, and fix issues found during verification. Revisit
earlier stages as necessary without stopping for approval. If the user explicitly
requests a review pause or a narrower deliverable, respect that request.

Ask only when missing information materially blocks the work and cannot be
inferred; continue independent work while waiting. This workflow does not change
system/tool permission checks or authorize unrelated changes, destructive actions,
or publication. Keep existing commit/push/PR boundaries below.

## The contract that makes the whole thing checkable

**When Storybook is present, a story export and its Figma frame share a name.** If the export is
`SavedWithWarnings`, the frame is `SavedWithWarnings`. Nothing enforces this, so
the skill does: every frame it draws is named for the export it mirrors, and it
reports any pre-existing frame that isn't.

When Storybook is present, its stories record the reachable states discovered
from code. Without Storybook, use the code-backed state table and app verification;
the Figma board or a screenshot alone cannot establish reachability.

## STAGE 0 — Read the ask

First check that `.claude/design-profile.md` exists; if not, run
`/design-profile` before going further.

Establish these facts from the request and repository; ask only for blocking gaps:

- **The Figma page URL** (with `node-id`) — where frames get drawn.
- **What to build** — "the save dialog", "the summary card".
- **Which app or package owns it.**

Briefly state the scope and proceed without waiting for confirmation.

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

### Checkpoint 1 — the state list

Validate the table against the code, report material uncertainties, and proceed
to implementation. Do not require confirmation of the state list.

## STAGE 2 — Components and optional Storybook

Implement components using the rules below. When Storybook is absent, skip the
story-specific bullets and Checkpoint 2, run the normal package checks, and
verify the components through the app or existing harness.

- **Reuse first.** Grep `<ui-barrel>` before creating anything; a variant of an
  existing component is props, not a fork. Re-implementing a headless primitive
  by hand is a rejected outcome.
- Components are **dumb**: props in, JSX out. No fetching, no stores, no routing.
- **One story per state from STAGE 1**, named so the Figma frame can match.
- Portaled surfaces (dialog, drawer, popover) need a story where they are open.
- Design tokens only — no inline hex literals. Reuse an appropriate token or add
  a justified token through the repository’s established token system. Record the
  choice and continue; missing tokens do not create an automatic approval pause.
- Follow the repo's own testing convention for this layer, whatever it is. If
  the shared package uses Storybook as its only harness, do not add tests to it.

Then run `<check-cmd>`.

### Checkpoint 2 — the stories

Inspect the stories, correct copy against the brief, and verify state coverage.
Give the story URLs as progress evidence and continue to the applicable next stage.

## STAGE 3 — Figma

Load the Figma plugin-API skill (`/figma-use`, or the MCP resource
`skill://figma/figma-use/SKILL.md`) before any `use_figma` call. On top of it:

- With Storybook, **frame name == story export name**. Without it, name frames
  for the corresponding states in the code-backed state table.
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

### Checkpoint 3 — the board

Post the screenshots and the node-ids. Report drift found on the way: any
existing frame whose name doesn't match its story export, and any state on the
board that STAGE 1 found unreachable. State plainly what is representative
rather than reproduced — placeholder art, unmeasured spacing, runtime behaviours
like sticky columns or scroll that a static frame cannot show. Resolve in-scope
drift and proceed without waiting for visual approval.

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

If wiring reveals a state STAGE 1 missed, update the state table, supporting
evidence, stories when Storybook is present, and applicable Figma frames, then continue through validation.

### Checkpoint 4 — the diff

Summarise what changed, the preflight numbers, and anything deliberately left
out. Finish only once the requested work and relevant checks are complete.

## STAGE 5 — Final handoff

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
| Prior-PR and git-history context | Scope and final verification |

A board's node tree is thousands of tokens of JSON to find six ids — that is
exactly what a subagent is for. Ask it for the inventory, not the tree.

Verify a delegated conclusion before you act on it. A sweep that reports a file
is unparseable, a field is optional, or a state is unreachable is a claim; the
cheap check that confirms it is usually one command.

## Redirect

When verification or user feedback reveals a problem, return to the stage
that owns it, make the correction, and continue:

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
- [ ] State table checked against code before implementation.
- [ ] Existing primitives reused; nothing re-implemented.
- [ ] Storybook availability checked; story work/checkpoint marked not applicable if absent.
- [ ] With Storybook: one story per reachable state, stories inspected, and copy checked.
- [ ] Without Storybook: reachable states and copy verified in the app or existing harness.
- [ ] Figma plugin-API skill loaded before any `use_figma` call.
- [ ] Tokens pulled live this run.
- [ ] Frames match story exports when present, otherwise state-table names; drift reported.
- [ ] Iterated in place — nothing deleted and recreated.
- [ ] Applicable Figma work verified before the app was wired.
- [ ] App work branched, test-first, preflight green on every consuming workspace.
- [ ] Nothing committed or pushed.

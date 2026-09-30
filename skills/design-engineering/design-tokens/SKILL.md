---
name: design-tokens
description: "Work with the repo's design tokens — the CSS custom properties a component is allowed to reference. Use when a component needs a colour, radius, font or spacing value, when a Figma design produces a value with no matching token, when adding or renaming a token, when auditing a file for hardcoded hexes, or when deciding whether a value deserves a token at all. Assumes a single layer of semantic custom properties consumed through utility classes, and says so where a multi-layer palette would differ."
---

# Design tokens

## Establish what your repo actually has

This pack assumes the shape below. Confirm it against your own token file before
relying on any of it.

One layer. Semantic CSS custom properties with literal hex values, declared in a
single `:root` block:

```css
:root {
  --primary: #3b82f6;
  --primary-foreground: #111827;
  --card: #ffffff;
  --muted-foreground: #6b7280;
  --border-subtle: #f3f4f6;
  --color-danger-fill: #b91c1c;
  --radius-card: 16px;
  --font-sans: …;
}
```

There is **no** `--hsl-*` raw layer, no `--color-<family>-<step>` palette alias,
no `@theme` block mapping tokens onto Tailwind utility names, and no parallel
dark-mode family. The generic design-system advice to build a two- or three-layer
token architecture does **not** apply here, and restructuring the token file is
not something to do as a side effect of building a component. If the layering is
worth changing, that is its own ticket with its own review.

## Where tokens live, and the sync obligation

Find the token files before editing one. `/design-profile` records them; if it
has not run, look for every stylesheet declaring custom properties and check how
many there are.

**One file** is the simple case: it is the authority, edit it.

**More than one** is the case that bites. Two files with overlapping properties
are one of three things, and they are not interchangeable:

| Shape | What it means | How to edit |
|---|---|---|
| Authority + subset | One file owns the brand; another mirrors a value-for-value subset for the shared package | Edit the authority first, then mirror. A token only the shared package needs still goes into the authority, so there is one place to read the brand. |
| Per-app overrides | Each app legitimately redefines some properties | Edit the one whose app you are in; do not propagate. |
| Duplicate nobody deleted | Drift waiting to happen | Say so, and stop. Deleting it is its own change. |

Get this wrong and every later token mapping points at the wrong file, silently.
If nobody can tell you which shape you have, that is a finding to report, not a
guess to make.

Whichever file the shared package ships against, a consuming app must define those custom
properties on a parent element — the primitives assume the names exist.

## How a token is consumed

Tailwind v4, arbitrary value, always:

```tsx
className="bg-[var(--card)] text-[var(--muted-foreground)] border-[var(--border-subtle)]"
```

There is no `@theme` mapping, so `bg-card` and `text-primary` **do not exist**.
Writing them produces no rule and fails silently — one of the two ways styling
breaks here without any tool complaining. (The other is a missing `@source`
directive, if your build uses one to tell Tailwind which files to scan.)

Two type hints Tailwind v4 needs:

- font family: `font-[family-name:var(--font-sans)]` — the bare
  `font-[var(--font-sans)]` emits nothing.
- where the root font-size is not 16px — 14px, say — `h-10` is 35px, not 40px. Where a
  design specifies pixels, write pixels: `h-[40px]`.

## The rule that matters most

**No hex literal outside the token file.** A colour in a component
is a token reference or it is a bug. Same for radius and font family.

Where a repo has one live exception — a focus colour hardcoded in a base
component and copied by anything that matches it, say — record it under Known gaps
and copy it for consistency. Do not mint a one-off token for one component.

## When a design produces a value with no token

In order:

1. **Look for a role match, not a hex match.** `--muted-foreground` is
   "secondary text on a light surface". If the design's value plays that role,
   use it even if the hex is a shade off. Role drives naming here.
2. **Near miss → use the existing token and flag the divergence** in the
   plan/PR body. The design file drifts from the brand constantly; silently
   forking a token per drift is how a palette becomes fifty greys.
3. **Genuinely new role → propose a token and stop.** Adding one means: pick the
   name, add it to the authority file, mirror it into any subset, and leave a
   comment recording *why* it exists and what it was measured against. That is a decision to raise, never a
   unilateral edit made mid-component.
4. **Never inline the hex "for now."** It never gets pulled back out.

## Naming

- Name for **appearance and role**, never for placement. `--color-warning-surface`,
  not `--banner-bg`. A placement name fuses two decisions that must
  stay separate: what something is, and where it happens to be used today.
- Follow the families already in the file rather than inventing a parallel
  scheme: base (`--card`), foreground pair (`--primary` / `--primary-foreground`),
  grade (`--color-danger`, `--color-danger-text`, `--color-danger-fill`,
  `--color-danger-text-strong`), surface/border siblings
  (`--color-warning-surface`, `--color-warning-border`).
- The `-fill` / `-text` / `-text-strong` split in the grade family is **contrast
  work, not decoration**: the brand hue often fails AA as small text, so a
  darkened sibling exists per background it is used on. Read the comment before
  reaching for the brand value in a text position.

## Contrast is part of the token, and it is written down

A derived colour token should carry its measured ratio in a comment — the usual
reason one exists is that the value it replaced failed AA against its background.
Adopt that practice: a new colour token states the pairing it was measured
against and the number. WCAG AA (4.5:1 normal text, 3:1 large/UI) is the floor.

This is the one place where an explanatory comment is required rather
than discouraged. The comment is the evidence for a decision that cannot be
re-derived from the value.

## Radius

Prefer a radius family named for **what it wraps** — `--radius-button`,
`--radius-input`, `--radius-chip`, `--radius-card`, `--radius-sheet`,
`--radius-pill` — over a t-shirt scale (`--radius-sm/m/lg`). Where both exist,
the named family is usually the newer one; check before picking.

Pick by what the element **is**, not by which value matches. Several will share
a value today; they exist separately so a card radius can move without dragging every
input with it.

Nested rounded elements need radii differing by their inset — an inset ring is
the container's radius minus the inset. There is no dense integer scale here, so
write the arithmetic result as a raw px value (`rounded-[15px]`) rather than
adding a token for one inset.

## Spacing — read this before transcribing a Figma value

Two independent things share the word "spacing" here:

1. **A `--spacing-*` custom-property set**, if the token file declares one.
   Plain custom properties in `:root` are **not** inside an `@theme` block, so
   they do **not** define Tailwind's scale — they are only usable as
   `p-[var(--spacing-lg)]`, and are often barely used.
2. **Tailwind's own scale**, left at its default `0.25rem` multiplier.

And the trap: check what `html` sets `font-size` to. If it is not 16px, every
rem-based utility is scaled accordingly — on a 14px root, `gap-4` is `1rem` =
**14px**, not 16px.

So a Figma 16px gap is **not** `gap-4`. Where a design gives an exact pixel
value, write the pixel value — `gap-[16px]`, `h-[40px]`, `px-[18px]`. Reach for the plain
`gap-4`-style scale only for values the design did not specify exactly.

## Known gaps

Keep a list like this for your own token file, and record these rather than
fixing them mid-task. The ones worth checking for:

- A focus colour with no token, living as a literal in a base component.
- No `@theme` mapping, so every token reference has to be an arbitrary value.
- No dark or second appearance mode. If a design ships one, that is a token
  architecture decision, not a component change.
- A subset file mirroring an authority file by hand, with nothing enforcing it.
  Diff the two when either is touched.

## Checklist

- [ ] No hex, radius or font literal outside the token files — focus ring and
      computed nested-inset radii aside.
- [ ] Radius picked by what the element is (`--radius-input`), not by matching px.
- [ ] New tokens land in the authority file first, then mirrored into any subset.
- [ ] New colour tokens carry their measured contrast ratio in a comment.
- [ ] Names describe role and appearance, never placement.
- [ ] Token references are `[var(--x)]` arbitrary values; no `bg-card` shorthand.
- [ ] `font-[family-name:…]` used for font family.
- [ ] px written as px where the design specifies px (check the root size).

# Priming a Figma file with your design tokens

Optional, one-time per Figma file, and worth doing for any file that will be
implemented more than once.

## Why

Drawing with hex values works. Drawing with **variables** works better, because
of what happens on the way back: `get_variable_defs` returns variable names, and
if those names match the CSS custom properties exactly, the token-mapping gate in
`figma-to-component` stops being a judgement call and becomes a lookup.

Without priming, the code step gets `#6b7280` and has to decide which token that
is. With priming it gets `muted-foreground` and the decision is already made.

## Naming is the contract

The Figma variable name is the CSS custom property **without the leading `--`**:

```
--card                ⇄  card
--muted-foreground    ⇄  muted-foreground
--radius-card         ⇄  radius-card
--color-danger-fill   ⇄  color-danger-fill
```

Exact correspondence means no mapping table exists, so nothing can drift. The
cost: a rename is now a change in two places at once. Treat it as work, not
tidying.

## Plan, then write

Never write straight from the parser to the API.

1. **Extract** — `python3 <skill-dir>/scripts/extract-tokens.py --css <token-file> --json` from the repo root.
   This is the only source; do not retype values from memory or from a design.
2. **Read** — fetch the file's current variables.
3. **Plan** — diff the two into a JSON plan: create / update / rename / orphan.
   Show it. A plan you can read before anything is written is the whole point of
   the split; it also lets you diff two runs and replay one.
4. **Write** — execute the plan in phases.

**Resolve everything in the planner.** Figma will not parse `color-mix()` or a
`var()` chain, so the plan carries concrete values. A conversion re-implemented
on the write side will diverge from the canonical one, and you find out through
two wrong colours.

## Rules that keep a re-run safe

- **Rename in place. IDs are the bindings.** A variable's ID is what every fill
  points at. `delete + recreate` silently unbinds every reference and the file
  still looks correct until someone changes a token. Match rename-vs-create by
  family and role, not by value.
- **Idempotent** — a re-run only creates, updates, or renames. A no-change run is
  a true no-op.
- **Orphans are flagged, never deleted.** A variable in the file with no token in
  code is a human decision.
- **Hard-fail on a missing dependency** rather than falling back. A silent
  fallback produces a file that looks fine and is wrong.
- **Phase order is a dependency graph**: colours → numbers (radius, spacing) →
  type → anything that references them.

## Three token shapes that need care

Check your own token file for each of these before priming:

1. **`color-mix()` values** — e.g. an overlay declared as
   `color-mix(in srgb, var(--black) 40%, transparent)`. Figma has no equivalent.
   Resolve to concrete rgba in the planner.
2. **`var()` aliases** — a token whose value is another token, e.g.
   `--surface-inverse: var(--black)`. Create these as Figma **variable aliases**
   pointing at the target variable, not as copies of its value. An alias keeps the
   chain the CSS has; a copy stops tracking the day the target changes.
3. **Shadows** — a composite shadow token. Figma has no shadow variable
   type, so it becomes an **effect style**. Bind via the style; never assign the
   effects array directly. Direct assignment inlines the values and silently
   breaks the binding — identical on the day, stale forever after.

## After a sync

Verify that nothing is unbound. Unbound is the exact symptom of an accidental
delete-and-recreate, and it is invisible until a token changes.

Re-prime when the token file changes. Nothing enforces this — and it may itself
be a hand-maintained mirror of another — so treat a token PR as
having a Figma follow-up.

---
name: design-components
description: "Write or review a shared UI component — variant maps, complete state binding across rest/hover/active/selected/focus/disabled, compound components over headless primitives, focus rings, icon colour, spacing discipline, and the props-vs-className call. Use when adding a primitive or shared component, adding a variant or state to an existing one, deciding whether something is a prop or a class, wiring a compound component's parts, or reviewing a component for state coverage. Assumes Tailwind + cva + Radix."
---

# Design-system components — @org/ui

Generic design-system rules, resolved against one concrete stack: Tailwind v4,
`cva`, `cn` (clsx + tailwind-merge), Radix primitives, single-layer CSS
custom-property tokens.

**Read `.claude/design-profile.md` first** — it records what *your* repo ships.
Where a rule here and your repo disagree, your repo wins; state the divergence.

## Bind every state explicitly. Never derive.

A variant names the token it ships for **every** state it can be in: rest, hover,
active, selected, focus-visible, disabled. Nothing computed at runtime — no
"darken by 10%", no colour function.

```ts
export const cardVariants = cva(
  [
    "rounded-[var(--radius-card)] font-[family-name:var(--font-sans)]",
    "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2",
    "focus-visible:outline-[var(--focus-ring)]",
    "disabled:cursor-not-allowed disabled:hover:opacity-100",
  ],
  {
    variants: {
      tone: {
        neutral: "bg-[var(--card)] text-[var(--foreground)] border-[var(--border-subtle)]",
        attention: "bg-[var(--color-attention-tint)] text-[var(--color-attention-text)] border-[var(--color-attention)]",
      },
    },
    defaultVariants: { tone: "neutral" },
  },
);
```

Verbose, and that is the point: reading the block tells you what paints in any
state without running it. A derived colour is a colour nobody specified and
nobody can review.

**Opacity as a hover treatment is one workable house pattern**
(`[@media(hover:hover)]:hover:opacity-50` on Button), and it *is* a derivation.
It is defensible only where it is uniform across the whole library and
pointer-gated. If yours already does this, keep it; do not extend it to colour.
Do not extend it to colour: `hover:opacity-50` is acceptable, `hover:bg-black/10`
over a token is not.

**Neutralise interactive states on disabled explicitly.** One way is
paired overrides (`disabled:hover:opacity-100`,
`disabled:focus-visible:outline-none`) rather than relying on source order.
Tailwind v4 supports `not-disabled:hover:…`, which is cleaner. If your library
already uses paired overrides, match the file you are in; either way do not mix
both in one variant map.

## Focus

A good baseline is a single `focus-visible` outline, offset 2px, in the brand
focus colour. Match the neighbouring components; do not introduce a second
`::after` inner ring for one component.

Before stating a focus-ring convention, **count what the library you are in
actually uses**:

```bash
grep -rhoE "focus-visible:(outline|ring)-[^ \"']+" <ui-package>/src | sort | uniq -c | sort -rn
```

If one value dominates, that is the convention — follow it. If several compete,
there is no convention, and any rule stated here would be fiction: **match the
neighbouring files in the area you are working in** and do not invent a token
for one component. Unifying a split like that is a library-wide decision, not
something to settle inside a component PR — record the gap instead.

The generic double-ring rule (outer border + `::after` inset by 1px, different
tokens per variant, sometimes absent) applies only if the whole library moves to
it. If a Figma design shows a two-ring focus treatment, that is a design-system
decision to raise, not a per-component implementation detail.

Radius arithmetic still holds wherever rings nest: an inset ring is the
container's radius minus its inset, so reach for the raw value that satisfies
that, not the nearest token. This is the one place a raw value beats a token —
the correct radius is derived arithmetically from the container's, so no token
can name it. It does not license raw colour values.

## Props vs className

- **Appearance that the design system sanctions → a prop** backed by a `cva`
  variant. `<Badge tone="attention" />`.
- **One-off positioning in a specific layout → a class at the call site**, passed
  through `className` and merged with `cn`. `<Badge className="ml-2" />`.
- **Never an exported class-name constant.** No
  `export const badgeClasses = "…"` shared between files. Classes live inline in
  JSX or inside the component's `cva` map; a variant is a boolean or union prop.
  Shared visual rules that genuinely cannot be a prop go in a CSS
  `@layer components` sheet, not a TS string.

Every component takes `className` and merges it last, so the call site can win.

## Spacing lives in the layout, not the leaf

```
✗  cva(["…", "ml-8 mt-4"])            margin baked into the component's own map
✓  layout owns the gap: <div className="flex gap-4"><Button /></div>
```

A component's own class map describes only itself — fill, border, radius, type,
states. Margin and position come from whatever is arranging it. This keeps
restyling from fighting positioning, and makes layout a visible tree rather than
attributes smeared across leaves.

A `Spacing` primitive is rarely worth having; flex/grid containers
with `gap-*` are the arrangement mechanism. `className` at a call site for a
one-off offset is fine — the rule is about the component's *internal* map.

## Compound components over Radix

Compounds (accordion, select, tabs, tooltip, toggle group, popover, drawer)
typically wrap a headless primitive:

### Context carries appearance. Never behaviour.

Open state, values, handlers, focus management and roving-focus bookkeeping stay
on the Radix primitive — it already solved them, and a second copy in a React
context is how the two drift. A context here publishes appearance only: variant,
size, tone.

```tsx
const contextValue = React.useMemo(() => ({ variant }), [variant]);

return (
  <SelectPrimitive.Root {...props}>
    <SelectAppearanceContext.Provider value={contextValue}>
      {children}
    </SelectAppearanceContext.Provider>
  </SelectPrimitive.Root>
);
```

Three load-bearing details: the value is memoised (compounds have many parts and
each one re-renders otherwise); the provider sits *inside* the primitive's Root
so Radix stays outermost with its own context intact; `children` passes straight
through, never inspected, never cloned.

A constraint worth adopting on top of the generic rule: **context is for
appearance; application state belongs in whatever store the app already uses —
never `useContext` as a state store.** `.claude/design-profile.md` records which
store that is.

### Scope the context to whoever owns the decision

Do not reflexively put it on the root. A menu surface can legitimately disagree
with its trigger — a light surface hanging off a dark button — so the *surface*
publishes surface appearance. Narrower still is fine.

### Share behaviour as hooks that return prop bundles

When siblings wrap different Radix primitives but must render identical chrome,
export a hook returning props rather than a wrapper component:

```tsx
const itemProps = useMenuItemProps();
<SelectPrimitive.Item {...itemProps} {...props} />
<DropdownPrimitive.Item {...itemProps} {...props} />
```

Zero extra DOM, each keeps its own element and prop types, and `{...props}`
*after* the bundle means the shared layer sets defaults without having final say.

**Shared props → a hook. Shared markup → a component.** Both can live in one
module; pick by what is actually shared.

### Focus return on dismissal depends on how it closed

Return focus to the trigger on **keyboard** dismissal (Escape, Enter, Space); do
**not** on a click. A keyboard user came from the trigger and has nowhere else to
be; a mouse user has already moved on, and pulling focus back steals their next
click and can scroll the trigger into view under them. Headless primitives
usually restore focus on *every* dismissal, pointer included — so this rule
needs an explicit override (Radix: `onCloseAutoFocus`). Check your library's
actual default before assuming it matches, and write down why you overrode it.

`stopPropagation` on Escape if the surrounding app has a global Escape binding,
or one keypress closes the overlay *and* fires the app's handler behind it.

## Icons: the container carries the colour

Every icon renders `currentColor`. The icon never picks its own colour; the
container sets the text colour and the icon inherits. An icon in a disabled
button, a hovered row or an error field then goes the right colour with no
wiring, and icon and label cannot drift apart.

The cost: multi-colour glyphs opt out of every state. Brand marks (a logo, an
illustrative mark) are the one exception worth carving out. Keep everything
else in your icon set monochrome.

An icon may take `className` for size, transform and transition. Colour is the
one thing it delegates upward.

## Responsive is CSS, not a prop — and usually a container query

A `device` / `layout` / `size` prop that means "desktop or mobile" is a JS
dependency where a stylesheet belongs. The parent then has to know the viewport,
which pushes the problem up the tree until something calls `useIsMobile`.

**Prefer a container query to a viewport media query.** A component inside a grid
cell cares about the cell's width, not the window's — a narrow cell on a wide
screen must still render the narrow shape. A worked example:
A card marks itself `@container` and uses `@[300px]:` / `@[345px]:`,
with the reason written down ("the gutter breakpoints key off the card, not the
viewport — cards sit one- or two-up depending on the route").

**The circularity trap, in two shapes.** A container query styles *descendants of*
the container, never the container element itself.

1. An element whose own *size* is the thing that changes — a 36px square that
   becomes 40px — cannot key off its own width: the query would read the width it
   is trying to set.
2. **A component that marks its own root `@container` cannot put `@[…]:` classes
   on that same root.** They are silently ignored — no error, no warning, the
   element just keeps its base styles while the children reshape correctly around
   it. Wrap: an outer element that only carries `@container`, an inner one that
   carries the shape. This one is easy to miss precisely because the children
   work, so the component looks nearly right.

In both traps the element must read an **ancestor** container. Mark `@container`
on the layout owner — the row, the cell — and
state the requirement in the component's docblock and its stories, because
"requires an ancestor marked `@container`" is otherwise an invisible contract
that fails silently by rendering the wrong shape.

**When the two shapes differ in content, render both and hide one.** `hidden` /
`@[Npx]:hidden` is `display: none`, which also removes the hidden branch from the
accessibility tree, so nothing is announced twice. The cost is real and belongs
in the API: if the wide shape shows a full name and the narrow one an
abbreviation, **both become required props** — the component can no longer pick
one, because it renders both.

**`useIsMobile` still has a place**, and it is narrow: when the *component type*
changes, not its shape. `Dialog` switching modal↔drawer is the real case — two
different Radix primitives, two different DOM trees, not one tree restyled.

## A shell primitive owns chrome your content must line up with

When you drop designed content into a shell the repo already has (`Dialog`,
`Drawer`, or whatever wraps them), the shell keeps rendering its own furniture:
a close button at a
fixed inset, a drag grabber above your first child. The design drew that
furniture *inside* the content, at the design's own coordinates. So your header
and the shell's close button end up on different lines, and the offset is
different per shell — the drawer's grabber pushes your content down, the
modal's does not.

Do not re-implement the shell to get the design's header back, and do not pass
`onClose` selectively to suppress the button — if one `onClose` drives the X,
the backdrop click and Escape, dropping it to hide the X removes dismissal
entirely.

Measure the two centres, then correct the offset in CSS:

```
[[data-<shell-attr>]_&]:pt-0
```

An ancestor-attribute variant tells you which shell you are in without a hook,
because the shell marks itself in the DOM (vaul, for instance, stamps
`data-vaul-drawer`). Check
what the shell actually stamps before relying on it — probe the DOM, do not
assume the attribute name.

Landing within ~3px of the shell's chrome is done. Chasing 0 means fighting a
primitive you do not own.

## Pick a dialog's container-query breakpoint from the shells, not the page

A dense table switches at `@[900px]` because that is where the *page* changes.
A dialog never gets near 900 — its two shapes are a 480px modal and a 393px
drawer. The breakpoint has to fall between the two shells' widths:
`@[400px]`. Reusing the page's number silently gives you one shape forever.

## Text fed by data needs an overflow decision the design will not have

Design files are built with placeholder strings — `Title`, `Label`, `1,234`. Nothing
in the frame has ever been long, so the overflow behaviour is unspecified rather
than deliberately absent. Decide it, and say that you decided it.

Truncation is two changes, not one — plus a third decision for the content that
must **not** truncate. `truncate` alone does nothing if any
ancestor refuses to shrink:

```tsx
<span className="flex min-w-0 items-center gap-[8px]">        // 1. group may shrink
  <Logo />
  <span className="min-w-0 truncate …">{item.name}</span>     // 2. text truncates
</span>
<span className="flex flex-1 items-center justify-end gap-[16px]">
  <span className="shrink-0 …">{item.meta}</span>
  <span className="grow text-right whitespace-nowrap …">{item.value}</span>  // and: protected
</span>
```

The flex chain needs `min-w-0` at every level **between the flex root and the
truncating text**, because `min-width: auto` on a
flex item refuses to shrink below content and the truncation silently never
happens.

**Protect the values that cannot be inferred.** `flex-1` is `flex: 1 1 0%` — it
both grows *and* shrinks below its content, so a number written that way clips to
nothing under pressure. Use `grow` plus `whitespace-nowrap` so it still fills the
slack but keeps its intrinsic width. Rank the content explicitly: a truncated
name is still readable, a clipped number is a wrong number.

## Text: element and style are orthogonal

Which element (semantics, document outline) and which style (family, size,
weight, leading) are independent choices. Do not ship an `h1…h6` ladder of
styles — fusing "this is a heading" with "this is big" is the most common way a
type system rots: someone needs large text, reaches for `<h2>`, and the outline
quietly breaks.

Where a component renders a heading whose level depends on context, take the
element as a prop (`as`) with a deliberate default.

## Anti-patterns

- A colour computed at runtime from another colour.
- A hex literal anywhere outside the token file(s) the profile names.
- Behaviour, open state or values duplicated into an appearance context.
- `useContext` used as an application state store.
- A component whose props are the union of three primitives' props.
- An exported class-name constant.
- Positioning classes baked into a component's own `cva` map.
- An icon with a hard-coded colour.
- A variant named for where it sits (`sidebar-card-button`) rather than how it
  looks (`secondary-fill`).
- A hand-rolled dropdown/dialog/tooltip when Radix ships one.

## Checklist

- [ ] Every variant names a token for rest, hover, active, selected, focus, disabled.
- [ ] Disabled explicitly neutralises hover/focus; no reliance on source order.
- [ ] Context carries appearance only, memoised, scoped to its owner.
- [ ] No positioning classes inside the component's own class map.
- [ ] Responsive handled in CSS; no `device`/`layout` prop standing in for width.
- [ ] Container-query contract stated in the docblock when an ancestor is needed.
- [ ] Every data-fed text has an overflow decision; `min-w-0` at each flex level.
- [ ] Values that must not clip use `grow` + `whitespace-nowrap`, never `flex-1`.
- [ ] Icons are `currentColor`.
- [ ] `className` accepted and merged last with `cn`.
- [ ] No exported class-name constants; no `any`, no non-null `!`, no type
      assertions (the polymorphic `as` **prop** is fine).
- [ ] Every variant and state is exercised in the repo's component harness.

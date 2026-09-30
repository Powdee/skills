---
name: memoization
description: "Review a React component or page for unnecessary re-renders and apply the fix — memo boundaries, stable callback and object identity, useRef Map caches for polled data. Use when a page feels sluggish, a list re-renders on every poll, or a profile has already shown where the time goes. For finding out where the time goes in the first place, use perf-research."
---

# Memoization & re-render prevention

Review the target component or page for unnecessary re-renders, then apply the
patterns below. They are ordered roughly by how often they apply, not by measured payoff — which
pattern wins on your page is a question for a profile.

**Measure before you memoise.** Every pattern here adds indirection, and applied
without a profile it buys nothing and costs readability. If you do not yet know
which component is re-rendering or why, run `perf-research` first.

If your build runs the React Compiler, Patterns 1–3 are largely handled for you —
check its output before adding them by hand. Patterns 4 and 5 still apply.

## Core Rules

1. **Wrap list-item components in `memo()`** so they only re-render when their own props change.
2. **Stabilise callback refs with `useCallback`** before passing them as props to memoised children.
3. **Derive expensive values with `useMemo`** instead of computing inline on every render.
4. **Cache API→derived-object transforms with a `useRef` Map** when the same API objects can be reused across fetches.
5. **Wrap page/layout entry points in `memo()`** to avoid cascading re-renders from parent state changes.

---

## Pattern 1 — `memo()` on list-item components

When a component is rendered inside a `.map()`, wrap it with `memo()` so React can bail out when props are unchanged.

```tsx
// NotificationRow.tsx
import { memo, useCallback } from 'react';

function NotificationRowComponent({ item, expanded, onToggle }: NotificationRowProps) {
  // Stabilise the callback so `Row` (memoised) never sees a new prop reference
  const handleToggle = useCallback(() => onToggle(item.id), [onToggle, item.id]);

  return (
    <Row title={item.title} body={item.body} expanded={expanded} onToggle={handleToggle} />
  );
}

const NotificationRow = memo(NotificationRowComponent);
export default NotificationRow;
```

**Why:** Without `memo`, every parent re-render (e.g. polling updates) re-renders every list item even if none of their data changed.

---

## Pattern 2 — `useCallback` for stable event handlers

Callbacks that are passed as props must be stable. Wrap them in `useCallback` with the correct deps so `memo()` on children is actually effective.

```tsx
// useNotificationsPage.ts
const handleToggle = useCallback(
  (id: string) => {
    setExpandedIds((prev) => ({ ...prev, [id]: !prev[id] }));
  },
  [] // the setState updater is stable, so this never needs re-creating
);
```

**Why:** A new function reference on every render defeats `memo()` — the child always sees a changed prop.

---

## Pattern 3 — `useMemo` for derived values

Compute derived values with `useMemo` so they are only recalculated when their inputs change.

```tsx
// NotificationsPageDesktop.tsx
const expandedItem = useMemo(
  () => items.find((item) => expandedIds[item.id]),
  [items, expandedIds]
);
```

```tsx
// SectionLayout.tsx
const tabs = useMemo(
  () => [
    { href: Routes.overview(), label: t('section.tabs.overview') },
    { href: Routes.active(), label: t('section.tabs.active') },
    { href: Routes.archive(), label: t('section.tabs.archive') },
  ],
  [t]
);
```

---

## Pattern 4 — `useRef` Map cache for API→derived transforms

When a hook fetches paginated data and re-derives objects on every fetch, use a `useRef` Map to preserve object identity for items that haven't changed. On polling-heavy pages this is often the pattern that moves the needle; confirm with a Profiler recording before and after.

```tsx
// useNotificationsPage.ts
const itemCacheRef = useRef(new Map<string, { raw: ApiItem; derived: DerivedItem }>());

const items = useMemo(() => {
  if (!query.data?.pages?.length) return [];

  const cache = itemCacheRef.current;
  const seenIds = new Set<string>();

  const result = query.data.pages.flatMap((page) =>
    page.data.map((raw) => {
      seenIds.add(raw.id);
      const cached = cache.get(raw.id);

      // Return the exact same derived object if the API item reference hasn't changed
      if (cached && cached.raw === raw) {
        return cached.derived;
      }

      const derived = mapApiItemToDerived(raw);
      cache.set(raw.id, { raw, derived });
      return derived;
    })
  );

  // Evict stale entries to avoid memory leaks
  for (const id of cache.keys()) {
    if (!seenIds.has(id)) cache.delete(id);
  }

  return result;
}, [query.data]);
```

**Why:** React Query's structural sharing (on by default) preserves object references for items whose serialised form did not change across refetches. Confirm it is enabled for your query — if it is off, or your client does no structural sharing, key the cache on a content hash instead of reference identity. By keying the cache on `raw === cached.raw` (reference equality), the derived object is only recreated when the API data actually changed — meaning `memo()` children skip re-renders for all unchanged rows.

---

## Pattern 5 — `memo()` on page/layout entry points

Wrap top-level page components that receive stable props from a parent with `memo()`.

```tsx
// NotificationsPage.tsx
import { memo } from 'react';

function NotificationsPage(props: Props) {
  const isMobile = useIsMobile();
  return isMobile
    ? <NotificationsPageMobile {...props} />
    : <NotificationsPageDesktop {...props} />;
}

export default memo(NotificationsPage);
```

---

## Checklist when reviewing a component

- [ ] Is this component rendered in a list? → `memo()`
- [ ] Does it receive callbacks as props? → `useCallback` in parent
- [ ] Does it compute a derived value inline? → `useMemo`
- [ ] Is it a top-level page/layout with stable props? → `memo()`
- [ ] Does a hook re-derive objects from polling/paginated data? → `useRef` Map cache
- [ ] Are all `useCallback`/`useMemo` dep arrays accurate and minimal?

## Profiling workflow

1. Open React DevTools → **Profiler** tab.
2. Enable "Record why each component rendered".
3. Trigger the interaction (e.g. a data poll, a click, a scroll).
4. Inspect the flame graph for unexpected re-renders — look for components that re-rendered but have unchanged data.
5. Apply the relevant pattern above, then re-profile to confirm the fix.

## What NOT to do

- Do not wrap every component in `memo()` indiscriminately — it adds overhead for components that always re-render.
- Do not add `useMemo`/`useCallback` for trivial values; the cost of the hook itself outweighs the benefit.
- Do not omit deps from `useCallback`/`useMemo` to "avoid re-creation" — use the ESLint `exhaustive-deps` rule as a guide.
- Do not use `useMemo` as a substitute for a proper selector/cache when the data comes from an external store.

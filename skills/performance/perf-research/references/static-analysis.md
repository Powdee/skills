# Static analysis recipes

Concrete, repeatable ways to produce numbers without a browser. Each recipe states
what it proves and — just as important — what it does **not** prove.

---

## Bundle: First Load JS per route

**Proves:** how many bytes a route costs on first visit, and how that splits between
the feature's own code and the shared app bundle.
**Does not prove:** parse/compile time (estimate it separately), or runtime cost.

Next.js prints a route table on a successful build — prefer it. If the build
fails late, at the page-data collection step, on something unrelated to your
feature, the manifest may still be usable: webpack emits the client chunks
before that step. Check the manifest's mtime against the build, and say in the
report that the build did not complete. If it failed *during* compilation, the
numbers are invalid — fix the build first.

```bash
<build-cmd> 2>&1 | tee /tmp/build.log   # may fail late; check whether it compiled
node <skill>/scripts/bundle-report.mjs    # reads .next/build-manifest.json (--dir= to override)
```

The script reports, per route: own chunks (gzip), First Load JS (gzip), First Load JS
(raw). Raw matters as much as gzip — **gzip predicts transfer time, raw predicts
parse and compile time**, and on mobile the second usually hurts more.

Rules of thumb for reporting:
- Compare the feature's routes against the app median and max. "~950 kB" means
  little; "~950 kB, of which ~880 kB is the shared bundle every route pays" is a
  finding.
- A rough parse/compile estimate: V8 processes on the order of 1 MB of JS per second
  on a mid-tier mobile device. State this as an assumption when you use it.

### Which packages are eagerly reachable

```bash
node <skill>/scripts/reachability.mjs <route-entry>   # src/pages/x.tsx or app/x/page.tsx
```

Walks static `import`/`export from` edges through first-party files, and records every
`node_modules` package it reaches. Anything reached only through `import()` is
reported separately as already code-split.

**Proves:** a package is in the eager graph, and the import chain that puts it there.
**Does not prove:** how many bundled bytes it contributes — tree-shaking may keep most
of it out. Report installed size as an *upper bound*, clearly labelled, and confirm
presence in the emitted chunk with a high-signal token grep before naming a number.

The import chain is the actionable part. "the analytics SDK is eager" invites a
shrug; "`_app` → `analytics/index` → `<sdk-wrapper>` → `<the-sdk-package>`" names the
edge to cut.

### Verifying a package really is in a chunk

Substring-grepping minified chunks for a package name produces false positives
(`moment` and `three` match ordinary words and strings). Verify with a token unique to
the library's source, and cross-check against `reachability.mjs`. If the two disagree,
trust the reachability walk and drop the claim.

### Code-splitting census

```bash
grep -rnE "next/dynamic|React\.lazy|\blazy\(" <src-dir> --include="*.tsx" --include="*.ts" | wc -l
grep -rnE "import\(" <src-dir> --include="*.tsx" --include="*.ts" | wc -l
```

Near-zero counts in a large app mean everything is eager. That pair of counts
often explains the whole Loading picture on its own.

---

## Rendering strategy

```bash
grep -rn "getServerSideProps\|getStaticProps\|revalidate" src/pages/<feature>
```

`getServerSideProps` means every navigation — including client-side ones, which fetch
the props JSON — pays a server round-trip before render. When the function only reads
a feature flag or validates a param, that's a real cost for near-zero benefit, and
it's worth naming.

---

## Subscription and listener census

**Proves:** how much per-item machinery the browser maintains. Static counting is
legitimate evidence here — as a **Bounded** finding, never a Measured one — as
long as you show the arithmetic and name the per-unit cost you multiplied by.

**Does not prove:** that any of it is slow. Counting is not timing; pair it with
a benchmark before assigning a cost.

Read the component tree for one list item and count, per item:

- store subscriptions — every `useStore(selector)`, **including those nested inside
  other hooks**; a "single" hook often subscribes three times
- CSS-in-JS style-hook calls — `useStyles()` / `createStyles()`, `styled`, `css`
- media-query hooks, ResizeObservers, IntersectionObservers
- event listeners attached outside React's delegated system

Then multiply by realistic item counts from step 1 of the skill (Scope the subject). Present it as
`per item × items = total`, so the reader can re-derive it.

Two things this census reveals that a benchmark won't:
- **Fan-out shape.** Selector-based stores and unmemoised context re-run every
  subscriber on every write, so the dispatch loop scales with *subscriptions*,
  not with what changed. A custom equality function trims re-renders, not the
  dispatch loop.
- **Invalidation blast radius.** Per-item media-query hooks mean one breakpoint
  crossing invalidates every item at once.

---

## Real-time transport census

For features backed by WebSocket/SSE/polling:

- **Channels per unit of content.** Multiply the per-unit channel count by the
  realistic number of units on screen, and by any nesting — a channel per row
  inside a channel per section compounds fast. Compute it at the largest
  realistic list length; that is the scaling ceiling. State where each
  multiplicand came from.
- **Batching.** Is the store write coalesced (`requestAnimationFrame`, microtask,
  debounce) or does each message write independently? An unbatched write path
  multiplies the fan-out above by the message rate.
- **Backgrounding.** Does the transport disconnect on `visibilitychange`?
- **Staleness guards.** Is there a timestamp/version check, and does it read the same
  source of truth the write path uses?

---

## Quadratic shapes

The highest-value scripting finding in most codebases, and the easiest to miss,
because it looks fine at small N.

Look for a "sync everything we have" effect keyed on accumulated data:

```tsx
// re-processes pages 1..P on every fetch — O(P²) across a scroll session
useEffect(() => {
  result.data?.pages.forEach(syncPageData);
}, [result.data, syncPageData]);
```

Benchmark it two ways — all-pages vs. newest-page-only — at several page counts, and
report both the per-fetch multiple and the cumulative waste across a full session.
The cumulative number is what makes the case.

Related shapes: nested scans over accumulated collections
(`for (const a of listA) for (const b of listB)`), full-map copies per item
instead of per batch, and re-derived formatting inside a per-update selector.

---

## Formatting inside hot paths

`Intl` constructors and `Date` formatting (`toLocaleDateString`, `toDateString`,
`Intl.NumberFormat`) are typically one to two orders of magnitude more expensive
than the surrounding logic — measure before asserting — and frequently
sit inside per-update selectors. Grep for them in the feature's selector and render
layers; they are usually hoistable or cacheable.

---

## Invalid nesting and hydration

```bash
grep -rn "<Link\|<a \|<button" <feature-dir> --include="*.tsx"
```

Look for an interactive element rendered inside another of the same kind — an anchor
inside an anchor, a button inside a button. The HTML parser closes the outer element
early, so the SSR DOM and the React tree disagree, and hydration repairs it by
re-rendering the subtree. Costs correctness, accessibility, and a render.

---

## Predicates that can never match

Read every call site of a filter, not just the definition:

```tsx
// default when the caller passes nothing: subCategory === undefined
const filtered = groups.filter((g) => subCategory && g.subCategory === subCategory);
// ...so at the no-argument call site this returns [] on every call, forever
```

The cost is small; the consequence — a feature that silently doesn't work — is not.
Always check the zero-argument and default-props call sites.

---
name: perf-research
description: Run a rigorous, evidence-first performance investigation on a feature or domain in the codebase and produce a findings report. Use when asked to research/audit/profile the performance of a feature, domain, route, or page — e.g. "how does the search page perform", "audit the dashboard for perf", "profile the checkout flow". Produces measured findings classified by Chrome DevTools work type, each with a verification step. Not for applying fixes — use /memoization for the fixes.
---

# Performance Research

Investigate the performance of one feature or domain and produce a findings report
grounded in measurements, not intuition.

The method follows the Chrome DevTools performance-profile review framework
(`references/profile-guide.md`) — its work-type taxonomy, its metric thresholds,
and above all its **verification principle**:

> Record before, change one thing, record after. Confirm the metric you targeted
> actually moved. A greener flame chart that did not move LCP or INP fixed nothing.

## The rule that matters most

**Never report a cost you have not measured or bounded.** Reading a `.map()` inside
a subscription and calling it "a performance problem" is speculation. The most
valuable output of this skill is often *"the hot path you were worried about costs
0.14 ms — leave it alone, the real cost is elsewhere."* Report that finding with the
same prominence as the problems. An audit that only finds problems is not an audit.

Every finding carries an honest provenance marker:

| Marker | Meaning |
|---|---|
| **Measured** | A number produced by a benchmark, build, or profile in this investigation |
| **Bounded** | Not directly measured, but derived arithmetically from something that was (e.g. counted subscriptions × measured per-subscription cost) |
| **Structural** | A property of the code with a known cost model but no number yet (e.g. "no virtualisation, DOM grows unboundedly") — always paired with the measurement that would confirm it |

## Procedure

### 1. Scope the subject

Establish exactly what is under study before touching anything.

- Which routes/pages? Find the real entry points (`src/pages/**`, `app/**`).
- Which directories hold the feature's code?
- What is the feature's *shape*: static content, list-heavy, real-time, form-heavy,
  animation-heavy? The shape decides which of steps 3–7 matter.
- What are the realistic data volumes? Page sizes, list lengths, update rates. Find
  these in constants (`PAGE_SIZE`, `staleTime`, polling intervals), not by guessing.

Write the scope down. It bounds everything after it.

### 2. Map the data flow

Trace one path end to end: network → cache → store → selector → component → DOM.
Name the actual files. You cannot classify costs until you know which layer owns them.

For real-time features, also map the update path: transport → batching → store
write → notification fan-out → re-render.

### 3. Loading — measure what ships

`references/static-analysis.md` § Bundle. Run:

```bash
node <skill>/scripts/bundle-report.mjs            # First Load JS per route, from the build manifest
node <skill>/scripts/reachability.mjs <entry>     # what is statically reachable (eager) vs dynamic
```

`bundle-report.mjs` needs a production build. If the build fails on pre-existing
errors unrelated to the feature, say so and note which numbers that invalidates —
webpack compiles the client chunks before the page-data step, so a failure there
usually leaves a usable manifest. A failure *during* compilation invalidates the
numbers entirely; fix the build first.

Answer these, with numbers:
- First Load JS for the feature's routes, and how much of it is the feature's own code
  vs. the shared app bundle. This ratio is frequently the headline finding.
- How many third-party packages are eagerly reachable from the entry? How many are
  code-split? Zero dynamic imports in a large app is a finding on its own.
- Which heavy dependencies land in the eager graph, and via which import chain?
  The chain is what makes it actionable.
- Rendering strategy: SSR per request, static, ISR? A `getServerSideProps` that only
  reads a feature flag pays a server round-trip on every navigation.
- Redundant fetches: does a detail route also fetch the list payload?

### 4. Scripting — benchmark the hot paths

This is where speculation is most tempting and least reliable. Benchmark instead.

Copy `templates/bench.mjs` and transliterate the real hot-path functions into it —
same algorithm, same allocation shape, realistic data volumes from step 1. Sweep the
volume (e.g. 20 → 400 items) so you learn the *scaling*, not just one point.

Benchmark, at minimum:
- The per-update write path (store reducer, cache update, normalisation).
- The subscription/selector fan-out: count subscriptions per rendered item from
  source, then measure the dispatch loop at realistic counts.
- Any work that re-runs per update: derived selectors, formatters, sorting, grouping.
- Anything with quadratic shape — re-processing accumulated data on each fetch is the
  classic one, and it hides well because small page counts look fine.

Report every result against a frame budget (16.7 ms) and apply a CPU multiplier
for mid-tier mobile — the profile guide's range is 4–6×, the bench template
defaults to 4×. State the multiplier as an assumption, don't bury it.

Include a sink variable in benchmarks so the JIT cannot elide the work, and check
that timings scale with input size — a flat line across a 20× volume sweep means you
measured nothing.

### 5. Rendering — count what the browser must maintain

Static counting is legitimate evidence here. From source, count *per rendered item*:

- store/context subscriptions
- CSS-in-JS style-hook calls (`createStyles`, `styled`, `css`)
- media-query / ResizeObserver / IntersectionObserver instances
- event listeners

Multiply by realistic item counts. Then check the structural questions:

- Is a long or infinitely-growing list virtualised? If the repo already depends on a
  virtualisation library that this feature doesn't use, say so.
- Are there nested interactive elements (anchor in anchor, button in button)? These
  are invalid HTML and produce hydration mismatches, which cost a client re-render.
- Layout thrash: reads of `offsetWidth`/`getBoundingClientRect` after writes.
- Animation on non-composited properties (`width`, `top`, `box-shadow`) instead of
  `transform`/`opacity`/`filter`.

### 6. Correctness defects with performance consequences

Look specifically for code that silently does nothing or does too much:

- Filters that can never match (a predicate guarded on a value that is always
  `undefined` at that call site).
- Effects that re-run on every update because a derived array/object identity churns.
- Subscriptions never torn down, or torn down and immediately recreated.
- Timestamp/version guards that compare against the wrong source of truth.

These matter more than micro-optimisations: a subscription list that is always empty
means the feature's live updates don't work at all.

### 7. Place the domain against its peers

A finding is easier to act on when the reader knows whether it is normal here.

```bash
node <skill>/scripts/domain-compare.mjs <domain> --domains=<dir-of-feature-dirs>
```

This profiles every domain in the codebase on the structural factors that predict
performance problems — memo coverage, virtualisation, code splitting, media-query
density, date formatting, real-time surface area — and reports where the domain
under study ranks, plus per-route chunk weight from the build manifest.

Be strict about what this is:

- **The only measured cross-domain number is route chunk weight.** It comes from the
  build. Everything else is a proxy counted from source.
- **Flags predict where to look, not what is slow.** A domain with six flags may be
  perfectly fast; one with zero may be crawling. Never let a flag count be read as a
  performance ranking, and say so in the report.
- **Use it to calibrate severity, and to pick the next investigation.** If the domain
  is the best in the codebase on a dimension, say that plainly — it changes whether a
  finding is "this domain's problem" or "the codebase's problem", which changes who
  owns the fix.

### 8. Rank, and say how to verify

Rank by **expected metric movement × confidence ÷ effort**, not by how interesting the
code is. For each finding give:

- ID (`L1`, `S2`, `R3`, `C1` — grouped by work type, referenced elsewhere in the report)
- work type: Loading / Scripting / Rendering / Painting / System
- provenance marker (Measured / Bounded / Structural)
- evidence: `file:line` plus the number
- the failure it causes, in user-visible terms
- the fix, at the smallest scope that works
- **verify by**: the specific metric and how to record it — this is not optional

### 9. Write the report

Use `templates/report.md`. Lead with what is *not* a problem, then the ranked
findings, the peer comparison, and finally the browser instrumentation protocol
(`references/profile-guide.md` § Recording protocol) so someone can reproduce the
runtime half.

Write it to a file in the repo so it can be reviewed, linked and diffed later.
A findings report that exists only in a terminal scrollback gets re-litigated
the next time someone worries about the same page.

## Deliberate non-goals

- **Don't apply fixes.** This skill produces evidence and a ranked plan. Applying
  React memoisation work is `/memoization`.
- **Don't optimise what you measured as cheap.** Write it down as cheap and move on.
- **Don't report a browser metric you didn't record.** If no trace was captured, the
  report says so and hands over the recording protocol instead of estimating LCP.

## Reference files

| File | Load when |
|---|---|
| `references/profile-guide.md` | Always — the taxonomy, thresholds, and recording protocol |
| `references/static-analysis.md` | Steps 3–6 — the concrete recipes and what each proves |
| `templates/bench.mjs` | Step 4 — benchmark harness skeleton |
| `templates/report.md` | Step 9 — report structure |
| `scripts/bundle-report.mjs` | Step 3 — First Load JS per route |
| `scripts/reachability.mjs` | Step 3 — eager vs. dynamic dependency graph |
| `scripts/domain-compare.mjs` | Step 7 — cross-domain structural risk profile and route weight |

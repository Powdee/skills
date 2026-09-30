# Chrome DevTools performance profile review framework

Condensed from https://perf.reviews/profile-guide. This is the taxonomy and the
recording protocol the `perf-research` skill classifies findings against.

## Work-type colour language

The performance panel encodes five categories of work. Classify every finding into
one — it forces you to name *which* engine subsystem pays, which in turn decides the
fix.

| Track colour | Category | What it covers |
|---|---|---|
| Yellow | **Scripting** | JS evaluation, compilation, callbacks |
| Purple | **Rendering** | Style recalculation, layout, hit-testing |
| Green | **Painting** | Paint, compositing, image decode |
| Blue | **Loading** | HTML parsing, network, resource decode |
| Grey | **System / Idle** | GC, profiler overhead |

A finding you cannot place in one of these is usually not yet a finding.

## Recording protocol

### Pre-flight

| Setting | Why |
|---|---|
| CPU throttle 4–6× | Approximates a real mid-tier device |
| Network throttle matched to real users | Otherwise the waterfall lies |
| Clean profile / incognito | Extensions distort the main thread |
| Cache disabled | Captures the first-visit experience |
| Screenshots enabled | Lets you tie metrics to visual change |

### The eight-step read

1. **Capture authentically** — throttling on, clean environment.
2. **Scope the range** — select the navigation-to-LCP window.
3. **Summary, then Insights** — take the categorised cost breakdown before theorising.
4. **Bottom-up, sorted by self time** — this surfaces the real cost, which is buried
   deep and invisible from the top of the call tree.
5. **Walk the long tasks** — anything >50 ms (red hatched corner); trace each initiator.
6. **Cross-check network against CPU** — thread idle while downloads run means
   network-bound; thread busy while nothing loads means CPU-bound.
7. **Read under the markers** — what executes beneath the FCP/LCP lines.
8. **Verify** — record before, change one thing, record after, compare the metric.

### Total time vs self time

- **Total time** — bar width including all children.
- **Self time** — work not done by children; this is the actual CPU burn.

Three views over the same data: flame chart (chronological), call tree (top-down),
bottom-up (self-time sorted). Bottom-up is where root causes appear.

### Threads

| Track | Contents | Implication |
|---|---|---|
| Main | JS, style, layout, paint, interactions | Every interaction competes here |
| Worker | Web/Service Worker JS | Already off the main thread |
| Raster / Compositor | Paint-to-pixels, layer assembly | Compositor-only animation lives here |
| GPU | Final screen rendering | Off-CPU |

## Metrics and thresholds

**LCP** — good ≤ 2.5 s, needs work ≤ 4 s, poor > 4 s.
Break it into four phases: TTFB, resource load delay, resource load duration,
element render delay.
The decision the breakdown drives: did the resource arrive late, or did rendering
arrive late?

**INP** — good ≤ 200 ms, needs work ≤ 500 ms, poor > 500 ms.
Three phases: input delay (grey, before the handler runs), processing (yellow, the
handler itself), presentation (green, frame rendering).

**CLS** — impact fraction × distance fraction, summed within the session window.
Prevented by pre-allocating space.

**TBT** — the blocking portion of every task over 50 ms, summed.

## Insights sidebar checklist

Automated insights, ranked by estimated metric saving. Work them in this order:

- LCP by phase — resource-late vs. render-late
- LCP request discovery — late-found or low-priority resources
- Render-blocking requests — CSS/JS delaying first paint
- Network dependency tree — critical request chains
- Forced reflow — JS reading layout after writing it
- DOM size — excessively large trees
- Layout shift culprits
- Third-party cost
- Duplicated JavaScript — the same module bundled more than once

## Waterfall reading

Read vertically. Bars starting at the same X were discovered together; a staircase
means each request waited for the previous one. Each bar shows queue/connect
(whiskers), TTFB wait (pale), download (solid), finish tail. For every request ask:
who initiated it — the HTML, or JS execution?

## Compositing

Safe to animate off the main thread: `transform`, `opacity`, `filter`.
Forces main-thread recomputation: `width`, `margin`, `top`/`left`, `box-shadow`, `color`.

Pipeline order, triggered by style change:
`Recalculate Style → Layout → Paint → Composite`.

## Framework signatures in the flame chart

- **React** — `performUnitOfWork`, `workLoopSync`, `Evaluate Script`
- **Hydration (SSR)** — `hydrateRoot`, `commitRoot`
- **Angular** — `invokeTask`, `runTask`, Zone.js
- **Vue** — `patch`, `flushJobs`, `reactiveEffect`

## Third-party categories

Each needs a different mitigation:

- Tag managers / analytics (GTM, Adobe Launch) — defer past interactive
- CMPs (OneTrust, Cookiebot) — assess critical-path placement
- A/B testing (Optimizely, VWO) — check anti-flicker blocking
- Session replay (Hotjar, FullStory, Clarity) — watch INP impact
- Ad tech (GPT) — isolate rendering impact
- Embeds (YouTube, Maps) — use facades
- Payment SDKs (Stripe, PayPal) — gate behind checkout routes

## Pro habits

- Ignore/dim third-party scripts to isolate first-party cost.
- Check the thread pool and GPU tracks for work already offloaded.
- Save traces as documents so they can be diffed and shared.
- Add noisy frames to the ignore list to collapse irrelevant stacks.

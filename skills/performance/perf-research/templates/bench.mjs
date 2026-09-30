/**
 * Hot-path benchmark harness — copy, then fill in the TRANSLITERATION section.
 *
 * Rules that keep the numbers honest:
 *
 *  1. Transliterate production code faithfully. Same algorithm, same allocation
 *     shape (same `new Map(prev)` copies, same `.map()` allocations). If you
 *     simplify it, you are benchmarking a different program.
 *  2. Use realistic data volumes, taken from constants in the codebase (page size,
 *     list length, nesting depth), not round numbers you like.
 *  3. Sweep the volume. One data point tells you nothing about scaling; a 20x sweep
 *     tells you whether it is O(n) or O(n^2).
 *  4. Keep a SINK. Without an observable side effect the JIT can delete the work
 *     and you will report zero.
 *  5. Sanity-check that timings scale with input size. A flat line across the sweep
 *     means the work was elided — fix the harness before reporting.
 *  6. Report against a frame budget and state the mobile multiplier as an
 *     assumption.
 *
 * Run: node bench.mjs
 */

import { performance } from 'node:perf_hooks';

// ---------------------------------------------------------------------------
// CONFIG — set from real constants in the codebase, and say where they came from
// ---------------------------------------------------------------------------

const VOLUMES = [20, 40, 60, 100, 200, 400]; // e.g. list length; PAGE_SIZE = 20
const FRAME_MS = 16.67;
const MOBILE_MULTIPLIER = 4; // profile guide: 4-6x CPU throttle for a mid-tier device

// ---------------------------------------------------------------------------
// FIXTURES — shaped like the real API payload, including nested collections
// ---------------------------------------------------------------------------

function makeItem(i) {
  return {
    id: `item_${i}`,
    // ... mirror the real shape: nested arrays, the objects your rows actually hold.
    // Sizes here dominate the result, so get them from a real response body.
  };
}

function buildState(n) {
  const byId = new Map();
  for (let i = 0; i < n; i += 1) byId.set(`item_${i}`, makeItem(i));
  return { byId };
}

// ---------------------------------------------------------------------------
// TRANSLITERATION — paste the real functions here, converted to plain JS
// ---------------------------------------------------------------------------

let SINK = 0;

/** e.g. the store reducer that every update goes through. */
function writePath(state, updates) {
  const next = new Map(state.byId); // keep the copy — it is part of the cost
  for (const u of updates) {
    const existing = next.get(u.id);
    if (existing) next.set(u.id, { ...existing, ...u.patch });
  }
  return { ...state, byId: next };
}

/** e.g. a derived selector that re-runs on every notification. */
function derivedSelector(state) {
  return Array.from(state.byId.values()).length;
}

// ---------------------------------------------------------------------------
// HARNESS
// ---------------------------------------------------------------------------

function bench(fn, iterations) {
  fn();
  fn();
  fn(); // warm the JIT
  const t0 = performance.now();
  for (let i = 0; i < iterations; i += 1) fn();
  return (performance.now() - t0) / iterations;
}

const fmt = (n) => (n < 1 ? n.toFixed(4) : n < 10 ? n.toFixed(3) : n.toFixed(2));
const pad = (s, n) => String(s).padStart(n);

function section(title) {
  console.log(`\n${'='.repeat(84)}\n${title}\n${'='.repeat(84)}`);
}

/** Print one sweep and flag a suspicious flat line. */
function sweep(title, columns, run) {
  section(title);
  console.log(['items', ...columns.map((c) => c.label), 'total ms', `% frame`, `% frame @${MOBILE_MULTIPLIER}x`].join(' | '));
  const totals = [];
  for (const n of VOLUMES) {
    const state = buildState(n);
    const results = columns.map((c) => bench(() => run(c.key, state, n), c.iterations ?? 500));
    const total = results.reduce((a, b) => a + b, 0);
    totals.push(total);
    console.log(
      [
        pad(n, 5),
        ...results.map((r, i) => pad(fmt(r), columns[i].label.length)),
        pad(fmt(total), 8),
        pad(((total / FRAME_MS) * 100).toFixed(1) + '%', 7),
        pad((((total * MOBILE_MULTIPLIER) / FRAME_MS) * 100).toFixed(1) + '%', 14),
      ].join(' | ')
    );
  }
  const growth = totals[totals.length - 1] / (totals[0] || 1);
  const volumeGrowth = VOLUMES[VOLUMES.length - 1] / VOLUMES[0];
  console.log('');
  console.log(`scaling: ${fmt(growth)}x cost across a ${volumeGrowth}x volume sweep` + (growth < 1.2 ? '  <-- SUSPICIOUS: work may have been elided' : ''));
}

// ---------------------------------------------------------------------------
// BENCHMARKS
// ---------------------------------------------------------------------------

sweep(
  'B1  Per-update cost',
  [
    { label: 'write', iterations: 500 },
    { label: 'selector', iterations: 2000 },
  ],
  (key, state) => {
    if (key === 'write') SINK += writePath(state, [{ id: 'item_0', patch: { v: SINK } }]).byId.size;
    else SINK += derivedSelector(state);
  }
);

/**
 * B2  Subscription fan-out.
 *
 * Count subscriptions per rendered item FROM SOURCE first (including ones nested
 * inside other hooks), then build that many closures and measure the dispatch
 * loop. This is what scales with a store that re-runs every subscriber.
 */
section('B2  Subscription fan-out per store write');
{
  const SUBS_PER_ITEM = 1; // <-- replace with the counted number, and show the count
  console.log(`${SUBS_PER_ITEM} subscriptions per item (counted from source)`);
  console.log('');
  console.log('items | subscriptions | dispatch ms | % frame | @' + MOBILE_MULTIPLIER + 'x ms | % frame @' + MOBILE_MULTIPLIER + 'x');
  for (const n of VOLUMES) {
    const state = buildState(n);
    const listeners = [];
    for (let i = 0; i < n; i += 1) {
      for (let s = 0; s < SUBS_PER_ITEM; s += 1) {
        const sel = (st) => st.byId.get(`item_${i}`);
        listeners.push({ sel, prev: sel(state) });
      }
    }
    const notify = () => {
      for (const l of listeners) {
        const next = l.sel(state);
        if (!Object.is(l.prev, next)) {
          l.prev = next;
          SINK += 1;
        } else SINK += 0;
      }
    };
    const ms = bench(notify, 300);
    console.log(
      [
        pad(n, 5),
        pad(listeners.length, 13),
        pad(fmt(ms), 11),
        pad(((ms / FRAME_MS) * 100).toFixed(1) + '%', 7),
        pad(fmt(ms * MOBILE_MULTIPLIER), 8),
        pad((((ms * MOBILE_MULTIPLIER) / FRAME_MS) * 100).toFixed(1) + '%', 14),
      ].join(' | ')
    );
  }
}

/**
 * B3  Quadratic check — "re-process everything accumulated" vs "process the new page".
 * Report the per-fetch multiple AND the cumulative waste over a whole session;
 * the cumulative figure is what makes the case.
 */
section('B3  Accumulated re-processing vs incremental');
console.log('Fill in with the real sync/normalisation path. Report:');
console.log('  pages | this-fetch ms (all) | incremental ms | waste x');
console.log('and the cumulative total across a full scroll session.');

section('Environment');
console.log(`node ${process.version} on ${process.platform}/${process.arch}`);
console.log(`Single-threaded, unthrottled. Apply ${MOBILE_MULTIPLIER}x for a mid-tier mobile device.`);
console.log(`sink=${SINK} (prevents dead-code elimination)`);

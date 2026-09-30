# Performance research: <feature or domain>

**Date** · **Commit** · **Author**

## 1. Scope

What is under study: routes, directories, realistic data volumes (with the constants
they came from). What is explicitly out of scope.

## 2. Method

What was measured and how — build, benchmark, static census. Environment: machine,
Node/browser version, throttling. State the mobile CPU multiplier as an assumption.

**What was not measured.** Be explicit. If no browser trace was recorded, say so here
and hand over the recording protocol in § 8 rather than estimating LCP/INP/CLS.

## 3. Architecture under test

The data path, end to end, naming real files: network → cache → store → selector →
component → DOM. For real-time features, the update path as well.

A diagram earns its place here if it shows the actual mechanism.

## 4. What is not a problem

Lead with this. The measurements that came back cheap, with their numbers, so nobody
spends a sprint optimising them. Name the thing that was *suspected* and the number
that cleared it.

## 5. Findings

Grouped by DevTools work type, ranked within group. Each finding:

### `L1` — <one-line claim>

| | |
|---|---|
| **Work type** | Loading / Scripting / Rendering / Painting / System |
| **Provenance** | Measured / Bounded / Structural |
| **Severity** | Critical / High / Medium / Low |
| **Evidence** | `path/to/file.ts:123` — the number |

**What it costs.** In user-visible terms, not just milliseconds.

**Why it happens.** The mechanism, briefly.

**Fix.** The smallest change that works.

**Verify by.** The specific metric and how to record it. Non-negotiable.

## 6. Measurements

The benchmark tables, with the sweep across data volumes so scaling is visible.
Include the environment line and the sink note.

## 7. Ranked remediation

| # | Finding | Expected movement | Confidence | Effort |
|---|---|---|---|---|

Ordered by expected metric movement × confidence ÷ effort. Say what you would do
first and what you would not do at all.

## 8. Browser instrumentation protocol

The reproducible recipe for the runtime half: pre-flight settings, the scenarios to
record, which markers to read, what to record before and after each change. So the
next person gets comparable numbers.

## 9. Threats to validity

Where the numbers could mislead: transliterated rather than instrumented code,
synthetic fixtures, unthrottled hardware, a build that failed partway, installed size
used as a proxy for bundled size.

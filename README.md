# Powdee Skills

Agent skills in two families, built on the same idea: **establish what is
actually true before acting on it.**

- **[Design](#design)** — keep code, Storybook and Figma telling the same story
  about what a component does.
- **[Performance](#performance)** — find out where the time actually goes before
  optimising anything.

## Install

**As a Claude Code plugin** — in a session:

```
/plugin marketplace add Powdee/skills
/plugin install powdee-skills@powdee-skills
```

Or from the terminal:

```bash
claude plugin marketplace add Powdee/skills
claude plugin install powdee-skills@powdee-skills
```

**With the `skills` CLI** — installs the skill files without the plugin wrapper:

```bash
npx skills@latest add Powdee/skills            # pick from a list
npx skills@latest add Powdee/skills -s '*'     # take all eight
```

**By hand:**

```bash
git clone git@github.com:Powdee/skills.git
cp -R skills/skills/*/* ~/.claude/skills/
```

Per-project instead of per-user: drop them in `.claude/skills/` in your repo and
commit them, so the whole team gets the same flow.

## Design

The problem is drift. A component grows a state; the story doesn't. Someone
renames a Figma frame; nothing notices. Six months later the board is a museum
piece and nobody trusts it. These skills make the three surfaces checkable
against each other, and put a human gate at every point where being wrong gets
expensive.

**Run `/design-profile` once per repo before anything else.** It probes for where
shared components live, the token file and its real token names, the styling
stack, Storybook's location, the check command and the testing convention — then
asks you about anything it can't settle and writes `.claude/design-profile.md`.
Every other design skill reads that file; without it they fall back to
placeholders and guess at your layout.

| Skill | Invoked by | What it does |
|---|---|---|
| **`design-profile`** | you | Learns the repo's conventions and writes them down. Run first, re-run when things move. |
| **`des-eng`** | you | The orchestrator. Discover states from the code → build them in Storybook → mirror them in Figma → wire to business logic. Four stages, a human gate after each. |
| **`prompt-to-figma`** | you | Prompt, sketch, or shipping component → a Figma board. Produces a design, not code. |
| **`figma-to-component`** | you | A Figma node → local components with stories. Stops before commit. |
| **`design-components`** | the model | House rules for writing a component: variant maps, complete state binding, compound components, focus rings, props vs `className`. |
| **`design-tokens`** | the model | When a value deserves a token, how to audit for hardcoded values, what to do when a design produces a value the system has no name for. |

Typical run:

```
/design-profile
/des-eng https://figma.com/design/<key>?node-id=1-23  add the confirmation dialog for checkout
```

## Performance

Most performance work goes wrong at the first step. Someone reads a `.map()`
inside a subscription, calls it a problem, wraps it in `useMemo`, and ships a
change that made the code harder to read and the page exactly as slow.

| Skill | Invoked by | What it does |
|---|---|---|
| **`perf-research`** | you | Investigates one feature or domain and produces a findings report grounded in measurements. Follows the Chrome DevTools profile-review framework — its work-type taxonomy, its thresholds, its verification principle. Does **not** apply fixes. |
| **`memoization`** | you | Applies the fix once you know what it is: memo boundaries, stable callback and object identity, `useRef` Map caches for polled data. |

In that order:

```
/perf-research  audit the dashboard
/memoization    apply finding 2 to the results table
```

The rules they enforce:

- **Never report a cost you have not measured or bounded.** Every finding carries
  a provenance marker, so nobody downstream mistakes a hunch for a number.
- **A null result is a result.** *"The hot path you were worried about costs
  0.14 ms — the real cost is elsewhere"* is reported as prominently as a problem.
  An audit that only finds problems is a list of things someone was already
  suspicious of.
- **Record before, change one thing, record after.** A greener flame chart that
  did not move LCP or INP fixed nothing.

`perf-research` ships runnable tooling, not just prose: reachability, domain
weight comparison and bundle composition scripts, a benchmark harness, a report
template, and two references: the profile-review framework and the
static-analysis recipes.

## What's in the repo

```
skills/design-engineering/   design-profile · des-eng · prompt-to-figma
                             figma-to-component · design-components · design-tokens
skills/performance/          perf-research · memoization
.claude-plugin/              plugin.json · marketplace.json
```

The repo is its own marketplace, which is why `marketplace add Powdee/skills`
and then `install powdee-skills@powdee-skills` are two different names for two
different things: the first is where to look, the second is what to install.

## Two ideas worth stealing even if you don't adopt the skills

**The naming contract.** A Storybook story export and its Figma frame share a
name. That one rule turns "is the design up to date?" from a discussion into a
set difference you can compute. Nothing enforces it, so the skills do — and they
report the mismatches they find rather than quietly fixing them.

**Reachability before drawing.** The state set is a property of *the app*, not of
the component. A shared component may offer eight variants where this surface can
reach four, because a prop is hard-coded off or an adapter drops a field. Drawing
the other four produces fiction that looks exactly like the real thing, and it
survives review because nothing about it looks wrong. Establishing the list from
the code, with `file:line` evidence, before anything is drawn, is the single
highest-value step in the flow.

## Why gates, and why not agents

Every stage ends with a human deciding. That is deliberate: a subagent can't stop
and ask — it reports once, at the end — so an autonomous version of this would
hand back a finished board built on a misread brief. The skills run in the main
thread and delegate only read-heavy work with no judgement in it: board recon,
codebase sweeps, name diffing.

The gates sit immediately before the expensive-to-undo step, not at the end. A
redirect at the brief costs one exchange; at the plan, a table; after merge, a
revert plus a stale board plus a token nobody can trace.

## Assumptions

These were extracted from a working monorepo, so a few carry assumptions worth
knowing:

- **`design-components`** assumes **Tailwind + `cva` + Radix**. Its rules about
  explicit state binding and compound components generalise; the code examples
  don't.
- **`design-tokens`** assumes a single layer of semantic CSS custom properties.
  If you run a multi-layer palette, read it as a set of questions rather than
  answers.
- **`perf-research`** is written against **React**. Three of its four scripts
  assume a webpack **Next.js Pages Router** build (`.next/build-manifest.json`),
  and `domain-compare.mjs` further assumes one directory per feature domain. The
  method — measure, classify, verify — carries anywhere; the scripts are the part
  that needs adapting.

`/design-profile` will tell you which of the design assumptions match your repo.

## Prerequisites

The Figma stages need the Figma MCP server and its `figma-use` skill, which the
skills load themselves.

The bundled scripts have no dependencies: the two design ones are stdlib Python,
the four performance ones are Node ESM (`.mjs`, Node 18+). `bundle-report.mjs`
and `domain-compare.mjs` additionally need a completed Next.js production build.

## Licence

MIT.

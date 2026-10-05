# Powdee Skills

Agent skills in three families, built on the same idea: **establish what is
actually true before acting on it.**

- **[Design](#design)** — keep code, Storybook and Figma telling the same story
  about what a component does.
- **[Performance](#performance)** — find out where the time actually goes before
  optimising anything.
- **[Motion](#motion)** — turn a product into a code-built motion film: brief,
  script, animation, voice sync and sound, 16:9 and 9:16 video.

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
npx skills@latest add Powdee/skills -s '*'     # take all fourteen
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

## Motion

`ultimate-motion`. A product explainer is usually a screen recording with music
laid on top: it stutters, any change means recording it again, and the voice
never quite lands on the click. These skills build the film in code instead. The
product's real UI, copy and data are recreated on a stage, and a deterministic
timeline drives it: a camera between named targets, a cursor that clicks, typed
prompts, counted numbers, re-sorting rows and drawing charts. Title cards set up
the pain and an end card pays it off. Every frame is a pure function of time, so
the voice-over can be the clock the animation follows, and Remotion renders it
frame-exact in 16:9 and 9:16.

**Run `/ultimate-motion`.** It asks what it can't learn from the product, then
calls the five stages in order and stops at each checkpoint.

| Skill | Invoked by | What it does |
|---|---|---|
| **`ultimate-motion`** | you | The orchestrator. Intake once, then brief → script → build → audio → render, with a human gate after the brief, the script and the stills. |
| **`motion-brief`** | the orchestrator | Reads the landing page, app code and demo data; pulls brand tokens, fonts and logos (`extract_brand.py`); picks the pain, the turn and 3–6 product moments, real copy and numbers marked real or illustrative. |
| **`motion-script`** | the orchestrator | The voice-over script for you to record or generate (ElevenLabs), and `beats.json`: the story time each line starts. Ships the Revitamal film as a worked example. |
| **`motion-build`** | the orchestrator | Scaffolds a Remotion project with the stage engine and a complete example film, recreates the product UI, title cards and end card, camera and cursor, with a separate camera path for 9:16. |
| **`motion-audio`** | the orchestrator | Finds each beat in your recording with whisper word timings and writes the sync map; ducked music; sound effects cued in story time so they follow the picture. |
| **`motion-render`** | the orchestrator | Renders both formats, sets loudness with one clean gain (−14 LUFS social, −16 web), contact sheets for QA. |

Typical run:

```
/ultimate-motion  a 45-second "how it works" for our landing page, repo is ~/code/app
                  …the script comes back; record it, then:
                  the voice-over is in ~/Downloads/voice.mp3
```

What they insist on:

- **The voice is the clock.** Animation timings live on the film's own story
  clock. A dozen `[voice, story]` pairs, found in the recording automatically,
  map one onto the other, so a new take is a re-sync, not a re-edit.
- **Real product, real words.** Labels, numbers and names come from the product.
  Example data is marked on screen, and nothing claims what the product can't back.
- **Deterministic or nothing.** No CSS animations or transitions, no randomness,
  no wall clock. Loops such as carets and shimmer are derived from story time, so
  the render matches the preview frame for frame.
- **Sound is yours.** The repo ships no audio. Voice, music and effects come from
  you, and missing effect files are skipped, so a film renders silently until they
  exist.

## What's in the repo

```
skills/design-engineering/       design-profile · des-eng · prompt-to-figma
                                 figma-to-component · design-components · design-tokens
skills/performance/              perf-research · memoization
skills/ultimate-motion/          ultimate-motion · motion-brief · motion-script
                                 motion-build · motion-audio · motion-render
.claude-plugin/                  plugin.json · marketplace.json
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

The motion skills need Node 18+, Python 3 and ffmpeg. `new_film.sh` installs
Remotion into each film project and a small Python venv (numpy) beside it. Remotion
fetches its own headless Chrome on first render. Voice sync additionally needs
whisper.cpp (`brew install whisper-cpp`) and the large-v3-turbo model in
`~/.cache/whisper-cpp/`.

## Licence

MIT.

---
name: ultimate-motion
description: Creates a finished motion-graphics product film from scratch, like a "How it works" explainer, product teaser, launch video or animated intro/outro. It writes the story and voice-over script, recreates the real product UI as animation (typed prompts, camera moves, cursor clicks, counting numbers, growing charts), adds title-card intro and logo end card, syncs to a voice-over the user supplies, and renders 16:9 and 9:16 MP4s at platform loudness. It runs motion-brief → motion-script → motion-build → motion-audio → motion-render in order. Use when the user says /ultimate-motion or asks for a motion graphic / animated / explainer / product / promo video, an animated intro or outro, or "a video like the one on our landing page", even if they don't name the steps.
---

# Ultimate motion

Make a product motion film the way the Revitamal "Jak to funguje" film was made:
- title cards that name a familiar pain (with a small gag);
- a turn ("There's a better way");
- a walkthrough of the real product UI, animated beat by beat in sync with a voice-over;
- a logo end card that pays off the opening line.

No camera footage is involved. The product's own UI, copy, data and brand are recreated as code and rendered to video.

This skill is the conductor. It gathers decisions once, then calls each stage with the Skill tool. Each stage leaves files in one project folder, so any stage can be re-run later on its own.

## 1. Intake (one round of questions, then defaults)

Ask only what you can't find out yourself. Read the codebase or landing page first, because most answers are in there.

- **Product**: repo path, landing page source or URL. This is the source of truth for wording, UI and data.
- **Goal and audience**, e.g. landing page explainer, social teaser, investor demo, onboarding.
- **Length** [explainer 45–60 s; teaser 15–20 s; intro/outro sting 4–8 s].
- **Formats** [16:9 and 9:16].
- **Language(s)** of on-screen text and voice.
- **Voice-over**: the user supplies it. They record it themselves or generate it, e.g. in ElevenLabs, from the script you write. Until it arrives, build on the story's own pacing.
- **Music and sound effects**: the user's files (music bed, click/typing/pop/count/chart sounds) [none: the film still works silently].
- **Brand**: fonts, colours and logo [taken from the codebase by motion-brief].

## 2. Stages, in order

Invoke each stage with the Skill tool, by name. When these skills come from the plugin, the names carry its prefix: `powdee-skills:motion-brief`. Pass the film project path and the intake decisions to each stage.

| # | Skill | Produces | Checkpoint |
|---|---|---|---|
| 1 | `motion-brief` | `brief.md`, `brand.json`, chosen product moments, real data | the user OKs the angle and the moments |
| 2 | `motion-script` | `script.md` (voice-over per language), `src/film/beats.json` | **yes**: the user reads the script and records or generates the voice |
| 3 | `motion-build` | Remotion project: product UI recreated, intro, end card, camera, cursor | **yes**: a stills sheet in both formats |
| 4 | `motion-audio` | voice synced to the picture, music bed, sound-effect cues | look at stills at each beat |
| 5 | `motion-render` | `<name>-16x9.mp4`, `<name>-9x16.mp4`, contact sheets | final summary |

Build can run before the voice exists. The film plays at the story's own pacing, and motion-audio later warps it onto the real voice without changing any animation. While the user records the voice, keep building.

## 3. What makes these films work

- **Real product, real words.** Copy every label and number from the product, landing page or seed data. Mark example data on screen (e.g. "Illustrative data"). Never invent claims, metrics or customers.
- **One idea per beat.** Each voice line triggers one visible change: a list sorts, a number counts up, a chart draws, a card pops. Animate the thing being said, while it is said.
- **Camera with intent.** Start tight on the question (the prompt input), pull back to the workspace, then push in on whatever the voice is about. In 9:16, visit one panel at a time.
- **Bookend the story.** The end-card line answers the opening gag ("investicni_plan_final_v7.xlsx" → "The last version of your investment plan.").
- **Calm craft.** Brand fonts and colours, soft eases, short staggers (0.04–0.12 s), no bouncing everything at once.
- **Deterministic.** Every frame is a pure function of story time. No CSS animations or transitions, no randomness, no wall clock.

## 4. Final report to the user

Give file paths and lengths, which on-screen data is illustrative, anything you assumed about the product, and what still needs the user: the voice-over if it isn't in yet, and licences for music. Mention that you checked stills and loudness, not a full viewing with sound, unless you watched it. Match the user's language.

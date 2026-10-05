---
name: motion-script
description: Stage 2 of the ultimate-motion film pipeline. Turns a product brief into a voice-over script and beat sheet for a motion-graphics product film. It plans intro title cards with a gag, the turn, product beats synced to spoken lines, and an end card. It writes script.md for the user to record or generate (e.g. ElevenLabs) and beats.json with the story time of every line. Use when writing or revising the narration or timing of an explainer, teaser, intro/outro or "how it works" video, or when /ultimate-motion calls it.
---

# Motion script

Write what is *said* and what *happens* at the same time, because they are one design. Read `references/storytelling.md` first. It has the structure, timing rules and the full Revitamal film as a worked example.

## 1. Plan the beats

Lay out the film on story time (seconds):

- **Intro title cards** run at negative times: about −6 to 0 for an explainer, shorter for a teaser.
- **The walkthrough** starts at 0, usually with a question being typed.

Per beat, write:
- the story time;
- the voice line (or none);
- what changes on screen;
- the camera (which element it frames);
- the sound (click, typing, pop, count, chart).

Typical pacing is one beat every 2–4 s, with a short line per beat. If a beat needs two sentences, it's two beats.

## 2. Write the voice-over

- Short spoken sentences of 6–12 words, in the product's tone.
- Name the thing on screen as it appears: "health thirty-eight out of a hundred" while 38 counts up.
- Numbers as they should be *spoken* in that language.
- For an explainer, aim for about 2.3 words per second; a teaser can run slightly faster.

## 3. Outputs, in the film project

- **`script.md`** holds the voice-over per language, one paragraph per beat, plus notes for recording:
  - natural pace and a small pause between beats;
  - one take per language, exported as MP3/WAV;
  - in ElevenLabs: pick one voice and keep the stability moderate so numbers stay clear.
- **`src/film/beats.json`**: `{ "language": "sk", "beats": [{ "story": -6, "say": "Investičný plán budov?" }, …] }`.
  - `say` holds the first words of the line. `motion-audio` finds them in the recording to place that beat.
  - Use words that are unique in the script. Repeated openings like "And…" confuse the matching.
  - Keep beats in increasing story order.

## Checkpoint

Hand the user `script.md` and ask them to record or generate the voice-over. Tell them exactly where to put the file, or to send its path. Meanwhile `motion-build` can start on the story's own pacing.

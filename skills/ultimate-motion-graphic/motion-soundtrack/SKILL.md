---
name: motion-soundtrack
description: "Give a product motion graphic its sound. Writes the voice-over script for ElevenLabs (timed per beat, numbers spelled out, delivery tags), syncs the recording so the animation lands on the words, places sound effects on the actions that cause them (typing, sends, AI answers, counters, pops), lays ducked background music under the voice and delivers one mixed track for the web player and for video. Use when someone wants narration, a voice-over, music or sound effects for a motion graphic, explainer or product video, sends an ElevenLabs recording to wire in, or asks why the sound is out of sync."
---

# /motion-soundtrack — voice, music and effects on the motion's clock

Sound makes or breaks an explainer, and almost all of the damage is timing: a click that lands
before the button moves, a sentence about a chart that ends before the chart appears, music
fighting the voice. This skill keeps every sound attached to what causes it. The voice-over
becomes the master clock (the animation warps to it), effects are read out of the animation's
own markup, and the music ducks under speech. The result is one mixed track the
`<motion-graphic>` player follows, and the same track muxed into video.

Needs a `<motion-graphic>` piece (see **product-motion**). Tools:
`eval "$(bash <skill-dir>/scripts/setup-tools.sh)"` (Playwright + ffmpeg in a shared cache).

## STEP 1 — Script the voice-over (if there is one)

Read `references/voiceover.md`. Write one line per storyboard beat within its time budget
(≈4.5 syllables/s Czech/Slovak, ≈2.5 words/s English), then hand the person **two versions**: a
table (beat, time window, line) to review, and **one plain block** to paste into ElevenLabs —
no labels, no clip names, or the voice reads them out. Spell numbers out, expand abbreviations,
never name real people or addresses, and use delivery tags sparingly (`[thoughtful]`, `[wry]`,
`[confident]`, `[warm]`, `[short pause]`). If the voice reads a tag aloud, that model does not
support it — remove it.

## STEP 2 — Sync the recording

```bash
python3 <skill-dir>/scripts/segments.py voice.mp3        # speech segments and pauses
```

Map segments to script phrases by order and length (one segment is roughly a sentence or a
clause). Then write **sync pairs** `[recording seconds, storyboard seconds]` at the moments where
words and actions must meet: the question typed while it is said, the click on the name, a count
reaching its number on the word, a pick on the sentence that justifies it, the logo on the brand
name. Rules that kept motion natural:

- pairs increase in both columns; the engine eases between them (monotone cubic);
- keep speed between pairs within ~0.5×–1.6× of the storyboard; slower is fine on static frames,
  near-holds are fine while a voice explains a still image;
- end with the card holding ~1.3 s after the last word.

Put the pairs in a data module (`[[0, -6], [2.6, -4.75], …]`) next to the audio path, render them
into `<audio data-sync>`, and check the important words with
`frames.cjs --playback --times <recording seconds>` from **product-motion**. Fix by moving pairs,
not by retiming the animation.

## STEP 3 — Get the effects, then cue them

Sound effects matter more than they seem. A key click under typing, a soft click on send, a chime
when the answer appears and ticks on a counter tell the viewer where to look and make the UI feel
alive; without them even a polished motion feels like a screen recording. So every piece gets
effects, from one of two places:

1. **The person's own.** Ask first: recorded effects, a library they have a licence for, or ones
   they generate in ElevenLabs Sound Effects (prompts in `references/mixing.md`) sound best.
2. **Otherwise, provide them yourself.** `python3 <skill-dir>/scripts/make-sfx.py sfx` synthesizes
   the default kit (typing, click, chime, tick, pop) with a ready `kit.json` — onsets and levels
   included — so the mix works straight away. Tell the person they are generated placeholders and
   that any file can be swapped later without touching the cues.

Read `references/mixing.md` (placement rules and levels). Mark cues where they happen:

- typed inputs: elements with `class="mg-typed"` get keyboard sound automatically;
- `data-sfx="click"` on the send button, `data-sfx="chime"` on the answer that appears,
  `data-sfx="tick"` on a counter (one tick per digit change), `data-sfx="pop"` on items that pop in;
- cursor clicks that deserve a sound: `"sfx": [{ "at": 19.6, "sound": "click" }]` in the storyboard.

Then extract them in playback time (they follow the voice warp automatically):

```bash
node <skill-dir>/scripts/events.cjs --url <page> [--open "<player button>"] --out events.json
```

## STEP 4 — Mix

Write `soundtrack.json` (schema in `scripts/mix.py`'s header) and run
`python3 <skill-dir>/scripts/mix.py soundtrack.json`. Point `"kit"` at the effects folder (its
`kit.json` holds modes, onsets and levels tuned against a voice around −20 dBFS speech RMS) and add
the person's music track:

- **With a voice:** music enters at the turn of the story (e.g. "There's a better way"), offset so
  its final hit lands on the end card, gain ≈ −14 dB, ducked under speech, EQ carve at 2.5 kHz.
- **Without a voice** (other locales): give the motion a soundtrack sync on its own pacing,
  `[[0, start], [duration − start, duration]]`, and let music play from the first frame.

Check what you can measure: the voice keeps its level (mean volume equal to the voice alone),
music sits ~15–17 dB under speech, nothing clips (peak < −1 dB), every cue starts within ~10 ms
of its time. You cannot hear the mix — say so, and ask the person to listen before shipping.

## STEP 5 — Deliver

- **Web:** the mixed MP3 becomes the `<audio data-sync>` source; the player follows it, so effects
  stay in sync through pause, scrub and replay. The mute button silences everything.
- **Server:** make sure audio is served as `audio/mpeg` with byte-range support (Safari).
- **Video:** pass the track (or the voice alone, for a voice-only cut) to **motion-export**.

## What people pushed back on

- A first set of quickly synthesized effects was rejected as cheap. Prefer the person's recorded
  or ElevenLabs effects; treat the generated kit as a placeholder and keep it low in the mix.
- Fewer sounds are better: clicks only on meaningful presses (send), no sound on charts drawing.
- "A little quieter" twice — start the effects and music lower than feels necessary.
- Mono voice converted to stereo lost 3 dB; the mixer now copies it to both channels at full level.

## No bundled audio

This skill ships no sound files. Effects come from the person or from `make-sfx.py`; music always
comes from the person, because licences differ per project.

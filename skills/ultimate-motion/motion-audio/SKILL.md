---
name: motion-audio
description: Stage 4 of the ultimate-motion film pipeline. Syncs a motion-graphics film to the voice-over the user supplies (their recording or an ElevenLabs/TTS export). It transcribes word timings with whisper, finds each scripted beat in the voice, writes the sync map so the animation follows the voice, then adds the music bed with ducking and sound-effect cues. Use when the user hands over a voice-over, music or sound effects for an animated explainer/teaser, when picture and voice drift apart, or when /ultimate-motion calls it.
---

# Motion audio

The animation keeps its own story clock. This stage maps the voice's clock onto it, so the picture follows the voice without re-timing a single animation.

## 1. Sync the voice

```sh
.venv/bin/python <skill-dir>/scripts/voice_sync.py <film-project> \
  --voice ~/Downloads/<voice>.mp3 [--music <music file>] [--lang sk]
```

The script needs `whisper-cli` and the large-v3-turbo model; install them with `brew install whisper-cpp` and download `ggml-large-v3-turbo.bin` to `~/.cache/whisper-cpp/` if missing. It:

- cleans the voice to −16 LUFS into `public/audio/voice.wav`;
- transcribes it with word timings;
- finds each beat's `say` words in order;
- writes `src/film/sync.json` with the pairs, voice, music and speech regions.

It prints one row per beat: story time, where it was found, and a match score. Check the rows:

- **"not found"** means the recording says it differently. Edit `say` to the actual words, or ask the user.
- **"out of order"** means a beat's words appear earlier too. Make `say` more specific.
- A match score below ~0.7 is worth a look.

Without a voice yet, run `--no-voice [--music …]` to keep the story's own pacing.

## 2. Check sync with stills at the beats

Use `<skill-dir>/../motion-build/scripts/stills.py` (the motion-build skill, a sibling of this one) at the story times of key beats. The stills land at the matching voice moments, because they go through the same map. If a reveal feels early or late against the line, nudge that beat's `story` value (not the animation) and re-run the sync.

## 3. Music and sound effects

- **Files:** the music bed and SFX are the user's (or licensed). Put SFX in `public/sfx/`. The template maps `click`, `typing`, `pop`, `count`, `chart` and `answer`; add kinds in `AUDIO.sfx`.
- **Cues:** live in `story.ts` → `AUDIO.cues`, in story time. Every click gets a click sound automatically. Typing cues use `dur` equal to the typing span. Use one pop per card group, not per chip.
- **Levels:** voice at full volume. Music around 0.10–0.14, ducked to 60 % while the voice speaks (`duckUnderVoice`). SFX around 0.3. Music fades in over 1 s and out over 1.5 s.

Hand back to `ultimate-motion` (next: `motion-render`).

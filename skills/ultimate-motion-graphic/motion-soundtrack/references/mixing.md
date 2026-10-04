# Mixing and placement

## Where sounds go

| Sound | When | Notes |
|---|---|---|
| typing | while text is typed into an input | plays from a keystroke in the recording for exactly the typing span; not on streamed answers |
| click | meaningful presses only (send) | people found a click on every pointer action noisy |
| chime | the moment an assistant answer appears | one per answer |
| tick | each time a counter's displayed value changes | slices of a tick recording, one per change, so every tick hits a digit |
| pop | items appearing in a grid or table | one per column/group (same-time cues merge) |
| music | from the story's turn, or from frame 1 without a voice | offset so its last hit lands on the end card |
| — | charts drawing, camera moves, title words | left silent on purpose; they read better without |

## Levels that worked (voice speech ≈ −20 dBFS RMS)

Gains depend on how loud each file is, so the targets are given as the level each effect reaches
in the mix — its loudest 50 ms RMS after `gainDb`. `make-sfx.py` sets its `kit.json` to these;
for other files, measure them with `python3 make-sfx.py --measure file.wav …` and set `gainDb` to
target − measured.

| Layer | Setting | Level in the mix |
|---|---|---|
| voice | 0 dB, mono copied to both channels | mean level identical to the voice alone |
| music | −14 dB, ducked (threshold 0.025, ratio 4, 20/600 ms), −4 dB @ 2.5 kHz | ≈ −39 dB RMS under speech, rises in pauses |
| typing | `span` mode | ≈ −27 dBFS |
| click | send only | ≈ −29 dBFS |
| chime | one per answer | ≈ −24 dBFS |
| tick | `slices` mode | ≈ −31 dBFS |
| pop | one per column | ≈ −28 dBFS |

Without a voice the track sits ~2–3 dB quieter overall; that is fine for a music bed.

## Getting better effects

The generated kit is a placeholder. Recorded effects, or ones generated in ElevenLabs Sound
Effects, sound more natural. Prompts that worked (dry, no music, one sound per file):

| Sound | Prompt | Length |
|---|---|---|
| typing | "Soft laptop keyboard typing at a steady medium pace, close mic, dry" | 5 s |
| click | "Single soft UI button click of a modern app, subtle, dry" | 0.5 s |
| chime | "Gentle two-note notification chime, warm, modern app" | 1.5 s |
| tick | "Twelve soft mechanical counter ticks, evenly spaced" | 4 s |
| pop | "Soft bubble pop of a UI element appearing, short, dry" | 0.5 s |

Put the files in a folder with a `kit.json` (same shape as the generated one): tick `onsets` come
from `segments.py tick.wav --threshold -30 --min-gap 0.1` (each tick is its own segment), typing
`offsets` are the starts of typing runs from the same script, one-shot `onset` is where the sound
starts; then set the gains with `--measure`. Whoever
generates them owns the licence question — check the plan's terms before publishing the files.

## Aligning the music's ending

Find the track's last hit (an RMS curve at 100 ms resolution shows where the body ends and the
ring-out starts). If the end-card logo appears at playback time `L` and the hit is at `H` seconds
into the track, start the music at `at` with `offset = H − (L − at)`. With a voice, start at the
turn of the story; without one, `at = 0` and the offset skips into the intro.

## Checks

```bash
$FFMPEG -i out.mp3 -af volumedetect -f null - 2>&1 | grep -E "mean|max"
```

- voice-only vs mix mean volume: equal (music and effects should not raise it noticeably);
- peak below −1 dB;
- onsets: compare an effects-only render's envelope with `events.json` (within ~10 ms);
- ducking: music RMS during a long sentence vs the same music undducked: ~10–12 dB lower.

## Web delivery

- Use the mixed MP3 as `<audio data-sync src>`; keep the voice-only file for re-syncs, outside the
  public folder.
- MP3 160 kbps stereo ≈ 1.2 MB per minute; load with `preload="none"` — the player fetches it when
  started.
- Servers must send `audio/mpeg` and support `Range` (206) or Safari stays silent.

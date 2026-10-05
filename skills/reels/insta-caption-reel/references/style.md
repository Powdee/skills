# The caption style

Every reel uses this exact look. It comes from the storyboard for the Revitamal "this is me" reel (Oct 2026). Don't invent new colours, fonts or effects. Use `../examples/revitamal-us-vertical.json` as the reference for how captions are split.

## Colours: two only, always solid

| Token | Hex | Use |
|---|---|---|
| `L` | `#f4f4f4` | Most words |
| `D` | `#032028` | Accents: about one word or line per caption. Use it whenever text sits on something bright (white curtain, white laptop) |

There is no transparency, no boxes, no outlines and no shadows. Never put `L` text over white curtains or a white laptop. Switch that word to `D` or move the caption.

## Faces

| Code | Face | Role |
|---|---|---|
| `HI` | Hellix Bold, sheared 11° and slightly emboldened | Main voice. At least half the words. Openers and hero words: HEY, FROM SCRATCH, ALRIGHT, LET'S GO |
| `SI` | Libre Bodoni Italic | Soft, connective or reflective words: CALLED, HOW DID I, NOW, AND, WONDERING, BACK, STARTUP |
| `ST` | Big Shoulders Stencil Black | Punchy concrete nouns and verbs: RUNNING, DINNER, TO WORK, the final AGAIN |
| `HU` | Hellix Bold upright | Brand and product names only, e.g. REVITAMAL in `D` |

Mix faces inside a caption, for example `I’M:HI L` + `BUILDING:HI D`, or `a:HI L` + `STARTUP:SI D`. Two neighbouring captions should not use the same face for their hero word.

## Text

- UPPERCASE everything. The one exception is a lone lowercase article `a` before a hero word (storyboard detail).
- Drop `. , ! — …`. Keep `?` and the typographic apostrophe `’` (I’M, LET’S, WHAT’S).
- Use the words exactly as they are spoken. If the storyboard text differs from the voice, the voice wins, and you tell the user.

## Splitting captions

- One caption is one breath or phrase of the voice, at most about 5 words and 1–3 lines. Split where the voice pauses (see the regions from `align.py`).
- The hero word sits on the last, biggest line. Support words go above it, smaller.
- Size ratio between hero and support words is at least 1.6×. Vertical hero sizes are about 230–380, support about 100–170. For landscape, multiply by about 0.8.
- Alternate alignment between consecutive captions: right → center → right → left …
- A caption should be on screen at least 0.3 s. Merge anything shorter (for example BACK + TO WORK).

## Font cycling

Use it on one or two moments per reel: the self-introduction ("THIS IS ME") and the emphatic one-word beat ("AGAIN!").

- Define the same words in 3 faces as `alts`, each with its own colour accents, exactly like the storyboard rows.
- Use `"cycle": {"after": 0.1–0.2, "step": 0.1, "seq": [...]}`. Settle on stencil or Hellix.

## Motion (built into the engine)

- **Word pop:** each word appears on its voice start and scales 0.35 → 1 with a slight overshoot over 0.2 s, rising 24 px. There are no fades.
- **Caption changes:**
  - consecutive captions hard-cut;
  - before a pause, a caption shrinks out in 0.12 s;
  - captions also cut with the shot cuts (`"end": "cut"`).
- **Camera:**
  - every shot slowly pushes in 1.00 → 1.04;
  - hard punch-ins of 1.08–1.12 land on hero beats (AGAIN, the payoff noun like DINNER, GO);
  - the last punch is held to the end (WORK);
  - a 0.25 s shake lands on a clap or `[claps]` cue (the non-speech region `align.py` reports).

## Timeline

- The voice drives everything. Cut between clips inside a voice pause, normally before a new thought (e.g. before "How did I even get here?").
- The film ends 2 s after speech ends. The last caption holds until speech end + 1.3 s, which leaves a clean ending.
- Camera audio is muted. Only the voice plays, normalised to −14 LUFS with true peak −1.5 dB.
- If the footage is shorter than the voice, first start the clip earlier or re-cut. Only then use slow motion (`"speed"` < 1, motion-interpolated). Keep speed ≥ 0.8 so it doesn't read as slow-mo.

## Placement

- **Vertical 1080×1920 (default for phone):**
  - captions sit on the wall above the head, bottom-anchored at y 590, never above y 230;
  - the Reels UI covers the top 220 and bottom 420 px;
  - side margins are 70 px;
  - the 9:16 window is cut around each clip's `face` point.
- **Landscape 1920×1080:** bottom 330, top 60, margins 110 / 1810.
- If the head sits higher or lower than in the Revitamal footage, move `layout.bottom` to about 50 px above the head top at the strongest punch-in.

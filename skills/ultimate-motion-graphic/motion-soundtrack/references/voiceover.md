# Voice-over scripts for ElevenLabs

## Budget per beat

| Language | Comfortable pace |
|---|---|
| Czech / Slovak | ≈ 4.5 syllables per second |
| English | ≈ 2.5 words per second |
| German | ≈ 2.2 words per second |

Write each beat's line, count it, and compare with the beat's window from the storyboard. Lines can
run a little long — the sync warps the animation — but more than ~1.6× the window makes the
animation rush. Leave the first beat of a hook room to breathe.

## Rules that make TTS sound right

- **Numbers as words:** "třicet devět ze sta", "two thousand twenty-seven". Digits get read
  unpredictably.
- **Expand abbreviations:** "AI" → "umělá inteligence" / "artificial intelligence" unless the brand
  insists; check how product names are pronounced ("Copilot" can need a phonetic spelling).
- **Don't read addresses or IDs** — they sound terrible and are often what you must not say.
  "This residential building" beats "Main Street five hundred eighteen to five hundred
  twenty-seven".
- **Pronouns after inserts:** when you add a sentence between a subject and "she/it", repeat the
  noun ("Why this building?") so the pronoun does not bind to the wrong thing.
- **Pauses:** "…" and paragraph breaks give short pauses; `[short pause]` where the model supports
  tags. Pauses between beats are ~0.2–0.4 s in practice — plan sync, not silence, for timing.
- **Tags sparingly:** `[thoughtful]` for the opening, `[wry]` on the joke in the hook,
  `[confident]` on the turn, `[excited]` once at most, `[warm]` on the closing line.

## Deliver two versions

1. A review table: beat · time window · line.
2. One plain block for ElevenLabs — no headings, no "Clip 1", no notes. Everything in the box is
   read aloud.

Example (Czech, about 60 s):

```
[thoughtful] Investiční plán budov v Excelu. [wry] Sedmá „finální“ verze... [short pause] [confident] Jde to i jinak! Stačí se zeptat: co opravit jako první? [thoughtful] Revitamal seřadí portfolio podle rizika. Nejvíc pozornosti potřebuje tento bytový dům... technický stav třicet devět ze sta. Ke každé budově propojí satelitní snímky, interní dokumenty, katastr i fotky interiéru a exteriéru... a umělá inteligence v nich označí nálezy. Proč právě tento dům? [excited] Copilot to vysvětlí: kritický stav střechy, opakované zatékání a rostoucí technický dluh. I se zdroji. Pak porovnáte rozpočty. Při třiceti milionech korun ročně zůstanou jen dvě rizikové budovy... to je doporučený scénář. A pro každou budovu si zvolíte plán obnovy, třeba na deset let: co opravit, kdy a za kolik. [short pause] První krok... střecha a výtah v roce dva tisíce dvacet sedm. [warm] Revitamal. Poslední verze vašeho investičního plánu.
```

## Recording settings that worked

A warm, confident voice in the "Natural" style; one take of the whole script (consistent tone);
export WAV or high-bitrate MP3. Regenerate single lines only if the voice stays consistent —
otherwise regenerate the whole take and re-sync.

## Mapping segments to phrases

`segments.py` splits on pauses ≥ 0.18 s. Expect one segment per sentence or clause; long lists
with commas usually stay one segment. Walk the script in order and match by length
(syllables ÷ 4.5 ≈ seconds for Czech). Within a long segment, estimate where a key word falls by
its syllable position. Place sync pairs on:

- the start of each beat's line → the beat's first visible change;
- key words → the action they name (click on the name, a count landing on the number, a pick on
  "recommended", the logo on the brand name);
- the end → hold the card ~1.3 s after the last word.

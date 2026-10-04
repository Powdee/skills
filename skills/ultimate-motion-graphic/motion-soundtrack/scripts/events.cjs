#!/usr/bin/env node
// Read the sound cues out of a <motion-graphic>, in playback time (the soundtrack's clock).
//
//   eval "$(bash setup-tools.sh)"
//   node events.cjs --url http://localhost:4321/ [--open "[data-how-it-works]"] --out events.json
//
// Cues come from three places, so they stay attached to the animation that causes them:
//   1. typed inputs: every .mg-typed[data-type] element → { typing: [{ from, to, keys: [...] }] }
//      (streamed answers use data-type without .mg-typed and get no keyboard sound)
//   2. markup:       any element with data-sfx="name" → a cue at the start of its data-pulse, else data-in
//                    (data-sfx-at="t" overrides). On a [data-count] element: one cue per value change.
//   3. storyboard:   "sfx": [{ "at": 19.6, "sound": "click" }] in the storyboard JSON
// Same-sound cues closer than 30 ms are merged. Times are converted with the element's toPlayback(),
// so they follow a voice-over time warp automatically.
const { chromium } = require("playwright");
const fs = require("fs");

const args = Object.fromEntries(process.argv.slice(2).reduce((pairs, value, index, all) => {
  if (value.startsWith("--")) pairs.push([value.slice(2), all[index + 1]]);
  return pairs;
}, []));
if (!args.url) { console.error("usage: node events.cjs --url <url> [--open <selector>] [--out events.json]"); process.exit(1); }

(async () => {
  let browser;
  try { browser = await chromium.launch({ channel: "chrome" }); } catch { browser = await chromium.launch(); }
  const page = await browser.newPage();
  await page.goto(args.url, { waitUntil: "load" });
  if (args.open) await page.click(args.open);
  await page.waitForFunction(() => customElements.get("motion-graphic") && document.querySelector("motion-graphic")?.storyboard);
  const events = await page.evaluate(() => {
    const motion = document.querySelector("motion-graphic");
    motion.pause();
    // The engine's own typing rhythm, so keyboard sounds land on the letters.
    const strokes = customElements.get("motion-graphic").keystrokes;
    const at = t => Number(motion.toPlayback(t).toFixed(3));
    const ease = {
      l: x => x, o: x => 1 - (1 - x) ** 3,
      io: x => x < 0.5 ? 4 * x ** 3 : 1 - (-2 * x + 2) ** 3 / 2,
      b: x => 1 + 2.4 * (x - 1) ** 3 + 1.4 * (x - 1) ** 2
    };
    const typing = [...motion.querySelectorAll(".mg-typed[data-type]")].map(element => {
      const [start, end] = element.dataset.type.split(/\s+/).map(Number);
      const keys = strokes(element.dataset.text ?? "", start, end).map(at);
      return { from: keys[0], to: keys[keys.length - 1], keys };
    });
    const cues = [];
    for (const element of motion.querySelectorAll("[data-sfx]")) {
      const sound = element.dataset.sfx;
      if (element.dataset.count && !element.dataset.sfxAt) {
        // One cue each time the displayed value changes.
        const [start, dur = "0.5", name = "o"] = element.dataset.count.split(/\s+/);
        const from = Number(element.dataset.from ?? 0), to = Number(element.dataset.value), decimals = Number(element.dataset.decimals ?? 0);
        let shown = from.toFixed(decimals);
        for (let t = Number(start); t <= Number(start) + Number(dur) + 0.002; t += 0.002) {
          const value = (from + (to - from) * (ease[name] ?? ease.o)(Math.min(1, Math.max(0, (t - Number(start)) / Number(dur))))).toFixed(decimals);
          if (value !== shown) { cues.push({ sound, at: at(t) }); shown = value; }
        }
        continue;
      }
      const source = element.dataset.sfxAt ?? element.dataset.pulse ?? element.dataset.in;
      if (source !== undefined) cues.push({ sound, at: at(Number(source.trim().split(/\s+/)[0])) });
    }
    for (const cue of motion.storyboard.sfx ?? []) cues.push({ sound: cue.sound, at: at(cue.at) });
    cues.sort((a, b) => a.at - b.at);
    const merged = cues.filter((cue, index) => !cues.slice(0, index).some(other => other.sound === cue.sound && Math.abs(other.at - cue.at) < 0.03));
    return { begin: motion.begin, end: motion.end, typing, cues: merged };
  });
  const out = args.out || "events.json";
  fs.writeFileSync(out, JSON.stringify(events, null, 1));
  const counts = events.cues.reduce((all, cue) => ({ ...all, [cue.sound]: (all[cue.sound] ?? 0) + 1 }), {});
  console.log(`${out}: ${events.typing.length} typed inputs, cues ${JSON.stringify(counts)}, length ${(events.end - events.begin).toFixed(2)} s`);
  await browser.close();
})();

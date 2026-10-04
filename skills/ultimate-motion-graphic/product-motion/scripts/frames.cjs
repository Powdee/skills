#!/usr/bin/env node
// Capture frames of a <motion-graphic> at storyboard times, for reviewing a storyboard beat by beat.
//
//   eval "$(bash setup-tools.sh)"
//   node frames.cjs --url http://localhost:4321/ [--open "[data-how-it-works]"] \
//     --times -5,0.5,3,9.2 --out ./frames [--size 1440x900] [--shot .mg-frame]
//
// --open    selector to click first (e.g. the button that opens a modal player)
// --times   storyboard seconds (the same clock as data-in / the storyboard JSON);
//           with --playback, soundtrack seconds instead (to check a voice-over sync word by word)
// --shot    element to screenshot (default: the motion's .mg-frame)
// Prints page errors. Frames are written as frame-<time>.png.
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const args = Object.fromEntries(process.argv.slice(2).reduce((pairs, value, index, all) => {
  if (value.startsWith("--")) pairs.push([value.slice(2), all[index + 1]?.startsWith("--") || all[index + 1] === undefined ? "true" : all[index + 1]]);
  return pairs;
}, []));
if (!args.url || !args.times) {
  console.error("usage: node frames.cjs --url <url> --times <t1,t2,…> [--open <selector>] [--out dir] [--size WxH] [--shot selector]");
  process.exit(1);
}
const [width, height] = (args.size || "1440x900").split("x").map(Number);
const out = args.out || "frames";
fs.mkdirSync(out, { recursive: true });

async function launch() {
  try { return await chromium.launch({ channel: "chrome" }); } catch { return chromium.launch(); }
}

(async () => {
  const browser = await launch();
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
  page.on("pageerror", error => console.log("PAGEERROR", error.message));
  page.on("console", message => { if (message.type() === "error") console.log("CONSOLE", message.text()); });
  // "load", not "networkidle": pages with looping background video never go idle.
  await page.goto(args.url, { waitUntil: "load" });
  if (args.open) await page.click(args.open);
  await page.waitForFunction(() => customElements.get("motion-graphic") && document.querySelector("motion-graphic")?.storyboard);
  await page.evaluate(async () => {
    const motion = document.querySelector("motion-graphic");
    motion.pause();
    motion.querySelector("audio")?.pause();
    await Promise.all([...motion.querySelectorAll("img")].map(image => { image.loading = "eager"; return image.decode().catch(() => {}); }));
  });
  await page.waitForTimeout(400);
  for (const time of args.times.split(",").map(Number)) {
    await page.evaluate(([t, playback]) => {
      const motion = document.querySelector("motion-graphic");
      if (playback) motion.render(t); else motion.seek(t);
      // Step CSS loops (caret blink, ring spin, shimmer) to the same clock so frames are reproducible.
      document.getAnimations().forEach(animation => { animation.pause(); animation.currentTime = Math.max(0, t) * 1000; });
    }, [time, args.playback === "true"]);
    await page.waitForTimeout(80);
    const target = await page.$(args.shot || "motion-graphic .mg-frame");
    const file = path.join(out, `frame-${String(time).replace("-", "m")}.png`);
    await target.screenshot({ path: file });
    console.log(file);
  }
  await browser.close();
})();

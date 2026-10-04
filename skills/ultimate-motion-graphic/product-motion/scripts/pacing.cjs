#!/usr/bin/env node
// Play a <motion-graphic> in real time and report frame pacing, plus where any long frames landed.
//
//   eval "$(bash setup-tools.sh)"
//   node pacing.cjs --url http://localhost:4321/ [--open "[data-how-it-works]"] [--size 1440x900]
//
// A healthy piece holds p99 ≈ 16.7 ms on a laptop. One-off long frames on a cold cache are usually
// image decode or a looping background video; run twice before chasing them.
const { chromium } = require("playwright");

const args = Object.fromEntries(process.argv.slice(2).reduce((pairs, value, index, all) => {
  if (value.startsWith("--")) pairs.push([value.slice(2), all[index + 1]]);
  return pairs;
}, []));
if (!args.url) { console.error("usage: node pacing.cjs --url <url> [--open <selector>] [--size WxH]"); process.exit(1); }
const [width, height] = (args.size || "1440x900").split("x").map(Number);

(async () => {
  let browser;
  try { browser = await chromium.launch({ channel: "chrome" }); } catch { browser = await chromium.launch(); }
  const page = await browser.newPage({ viewport: { width, height } });
  page.on("pageerror", error => console.log("PAGEERROR", error.message));
  await page.goto(args.url, { waitUntil: "load" });
  if (args.open) await page.click(args.open);
  await page.waitForFunction(() => customElements.get("motion-graphic") && document.querySelector("motion-graphic")?.storyboard);
  const length = await page.evaluate(() => {
    const motion = document.querySelector("motion-graphic");
    window.__frames = [];
    window.__long = [];
    let last = performance.now();
    const loop = now => {
      const delta = now - last;
      last = now;
      window.__frames.push(delta);
      if (delta > 33) window.__long.push([Math.round(delta), Number(motion.warp(motion.time).toFixed(2))]);
      if (motion.dataset.state !== "ended") requestAnimationFrame(loop);
    };
    if (motion.dataset.state !== "playing") motion.start();
    requestAnimationFrame(loop);
    return motion.end - motion.begin;
  });
  await page.waitForFunction(() => document.querySelector("motion-graphic").dataset.state === "ended", null, { timeout: (length + 30) * 1000 });
  const report = await page.evaluate(() => {
    const frames = window.__frames.slice(5).sort((a, b) => a - b);
    const pick = q => frames[Math.floor(frames.length * q)].toFixed(1);
    return { frames: frames.length, p50: pick(0.5), p95: pick(0.95), p99: pick(0.99), longFrames: window.__long };
  });
  console.log(JSON.stringify(report, null, 1));
  console.log("longFrames are [duration ms, storyboard time s]");
  await browser.close();
})();

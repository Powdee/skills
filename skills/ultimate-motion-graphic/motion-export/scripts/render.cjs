#!/usr/bin/env node
// Render a <motion-graphic> to an MP4, frame by frame, with its soundtrack.
//
//   eval "$(bash setup-tools.sh)"
//   node render.cjs --url http://localhost:4321/ [--open "[data-how-it-works]"] --out video.mp4 \
//     [--width 1920] [--fps 30] [--audio soundtrack.mp3 | --audio none] [--from 0 --to 12]
//
// Every frame is drawn with the element's own render(t) and the page's CSS loops are stepped to the
// same clock, so the file is exact no matter how slowly the browser captures. The stage is pinned to
// the viewport at its design size and captured at --width (default 1920) via device scale factor.
// Audio: --audio file, or the element's <audio> src when present (ffmpeg reads it over HTTP).
const { chromium } = require("playwright");
const { spawn } = require("child_process");

const args = Object.fromEntries(process.argv.slice(2).reduce((pairs, value, index, all) => {
  if (value.startsWith("--")) pairs.push([value.slice(2), all[index + 1]]);
  return pairs;
}, []));
if (!args.url || !args.out) {
  console.error("usage: node render.cjs --url <url> --out <file.mp4> [--open <selector>] [--width 1920] [--fps 30] [--audio <file>|none] [--from s --to s]");
  process.exit(1);
}
const fps = Number(args.fps || 30);
const ffmpeg = process.env.FFMPEG || "ffmpeg";

(async () => {
  let browser;
  try { browser = await chromium.launch({ channel: "chrome" }); } catch { browser = await chromium.launch(); }
  // Probe the stage size first so the viewport matches it exactly.
  const probe = await browser.newPage();
  await probe.goto(args.url, { waitUntil: "load" });
  if (args.open) await probe.click(args.open);
  await probe.waitForFunction(() => customElements.get("motion-graphic") && document.querySelector("motion-graphic")?.storyboard);
  const stage = await probe.evaluate(() => ({ width: document.querySelector("motion-graphic").stageWidth, height: document.querySelector("motion-graphic").stageHeight }));
  await probe.close();

  const width = Number(args.width || 1920);
  const page = await browser.newPage({ viewport: stage, deviceScaleFactor: width / stage.width });
  page.on("pageerror", error => console.log("PAGEERROR", error.message));
  await page.goto(args.url, { waitUntil: "load" });
  if (args.open) await page.click(args.open);
  await page.waitForFunction(() => customElements.get("motion-graphic") && document.querySelector("motion-graphic")?.storyboard);
  const info = await page.evaluate(async () => {
    const motion = document.querySelector("motion-graphic");
    motion.pause();
    motion.querySelector("audio")?.pause();
    // Pin the frame over everything at its design size; hide the player chrome.
    const frame = motion.querySelector(".mg-frame");
    Object.assign(frame.style, { position: "fixed", inset: "0", width: `${motion.stageWidth}px`, height: `${motion.stageHeight}px`, zIndex: "2147483647", margin: "0", borderRadius: "0" });
    motion.querySelector(".mg-controls")?.style.setProperty("display", "none");
    const images = [...motion.querySelectorAll("img")];
    images.forEach(image => { image.loading = "eager"; });
    await Promise.all(images.map(image => image.decode().catch(() => {})));
    const audio = motion.querySelector("audio[src]");
    return { begin: motion.begin, end: motion.end, audio: audio ? new URL(audio.getAttribute("src"), location.href).href : null };
  });
  await page.waitForTimeout(600);

  const from = args.from !== undefined ? Number(args.from) : info.begin;
  const to = args.to !== undefined ? Number(args.to) : info.end;
  const frames = Math.round((to - from) * fps);
  const audio = args.audio === "none" ? null : args.audio || info.audio;
  console.log(`rendering ${frames} frames (${(to - from).toFixed(2)} s at ${fps} fps, ${width}×${Math.round(width * stage.height / stage.width)})${audio ? ` with ${audio}` : ""}`);

  const output = ["-y", "-loglevel", "error", "-f", "image2pipe", "-framerate", String(fps), "-c:v", "mjpeg", "-i", "-"];
  if (audio) output.push("-ss", String(Math.max(0, from)), "-i", audio, "-map", "0:v", "-map", "1:a", "-c:a", "aac", "-b:a", "192k");
  // Screenshots are full-range JPEG; convert to the TV range players expect, or colours look washed out.
  output.push("-vf", "scale=in_range=pc:out_range=tv,format=yuv420p", "-c:v", "libx264", "-preset", "slow", "-crf", "17", "-r", String(fps), "-movflags", "+faststart", "-t", String(to - from), args.out);
  const encoder = spawn(ffmpeg, output, { stdio: ["pipe", "inherit", "inherit"] });
  const started = Date.now();
  for (let i = 0; i < frames; i++) {
    const t = from + i / fps;
    await page.evaluate(time => {
      document.querySelector("motion-graphic").render(time);
      // Step the CSS loops (caret, ring spin, shimmer) on the same clock as the timeline.
      document.getAnimations().forEach(animation => { animation.pause(); animation.currentTime = Math.max(0, time) * 1000; });
    }, t);
    const buffer = await page.screenshot({ type: "jpeg", quality: 94 });
    if (!encoder.stdin.write(buffer)) await new Promise(resolve => encoder.stdin.once("drain", resolve));
    if (i % (fps * 10) === 0) console.log(`frame ${i}/${frames} · ${((Date.now() - started) / 1000).toFixed(0)} s`);
  }
  encoder.stdin.end();
  const code = await new Promise(resolve => encoder.on("close", resolve));
  console.log(code === 0 ? `${args.out} done in ${((Date.now() - started) / 1000).toFixed(0)} s` : `ffmpeg exited with ${code}`);
  await browser.close();
  process.exit(code === 0 ? 0 : 1);
})();

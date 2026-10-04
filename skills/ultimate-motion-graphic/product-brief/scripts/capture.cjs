#!/usr/bin/env node
// Capture a live page for product and brand research: full-page screenshots (desktop + mobile), one
// screenshot per section, and a text outline of what the page says.
//
//   eval "$(bash setup-tools.sh)"
//   node capture.cjs --url https://example.com [--out ./brief-capture] [--wait 1500]
//
// Writes desktop.png, mobile.png, section-NN-<id>.png and outline.md (headings, buttons, links,
// paragraphs in reading order, plus computed fonts and colours of key elements). Logged-in platforms:
// pass a URL you can reach, or capture from a local dev server.
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const args = Object.fromEntries(process.argv.slice(2).reduce((pairs, value, index, all) => {
  if (value.startsWith("--")) pairs.push([value.slice(2), all[index + 1]]);
  return pairs;
}, []));
if (!args.url) { console.error("usage: node capture.cjs --url <url> [--out dir] [--wait ms]"); process.exit(1); }
const out = args.out || "brief-capture";
fs.mkdirSync(out, { recursive: true });

(async () => {
  let browser;
  try { browser = await chromium.launch({ channel: "chrome" }); } catch { browser = await chromium.launch(); }
  for (const [name, viewport] of [["desktop", { width: 1440, height: 900 }], ["mobile", { width: 390, height: 844 }]]) {
    const page = await browser.newPage({ viewport });
    await page.goto(args.url, { waitUntil: "load" });
    await page.waitForTimeout(Number(args.wait || 1500));
    // Scroll through once so lazy content loads before the full-page shot.
    await page.evaluate(async () => {
      for (let y = 0; y < document.body.scrollHeight; y += innerHeight / 2) { scrollTo(0, y); await new Promise(r => setTimeout(r, 60)); }
      scrollTo(0, 0);
    });
    await page.screenshot({ path: path.join(out, `${name}.png`), fullPage: true });
    if (name === "desktop") {
      const sections = await page.$$("main > section, main > div > section, body > section, section[id]");
      let index = 0;
      for (const section of sections) {
        const box = await section.boundingBox();
        if (!box || box.height < 80) continue;
        const id = (await section.getAttribute("id")) || "section";
        await section.screenshot({ path: path.join(out, `section-${String(++index).padStart(2, "0")}-${id}.png`) }).catch(() => {});
      }
      const outline = await page.evaluate(() => {
        const lines = [`# ${document.title}`, "", `URL: ${location.href}`, ""];
        const describe = el => {
          const style = getComputedStyle(el);
          return `${style.fontFamily.split(",")[0]} ${style.fontSize}/${style.fontWeight} · ${style.color}${style.backgroundColor !== "rgba(0, 0, 0, 0)" ? ` on ${style.backgroundColor}` : ""}`;
        };
        lines.push("## Type and colour samples");
        for (const selector of ["h1", "h2", "h3", "p", "a.button, .button, button", "nav a"]) {
          const el = document.querySelector(selector);
          if (el) lines.push(`- ${selector}: ${describe(el)}`);
        }
        lines.push(`- body background: ${getComputedStyle(document.body).backgroundColor}`, "", "## Content in reading order");
        const walker = document.querySelectorAll("h1, h2, h3, h4, p, li, a, button, figcaption, dt, dd");
        const seen = new Set();
        for (const el of walker) {
          const text = el.innerText?.replace(/\s+/g, " ").trim();
          if (!text || text.length < 2 || seen.has(text) || el.closest("[aria-hidden='true']")) continue;
          seen.add(text);
          const tag = el.tagName.toLowerCase();
          const prefix = tag.startsWith("h") ? "#".repeat(Number(tag[1]) + 1) + " " : tag === "a" || tag === "button" ? "- [action] " : "- ";
          lines.push(prefix + text.slice(0, 300));
        }
        return lines.join("\n");
      });
      fs.writeFileSync(path.join(out, "outline.md"), outline);
    }
    await page.close();
  }
  console.log(`captured ${args.url} → ${out}/ (desktop.png, mobile.png, section-*.png, outline.md)`);
  await browser.close();
})();

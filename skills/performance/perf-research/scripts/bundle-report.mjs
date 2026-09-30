#!/usr/bin/env node
/**
 * First Load JS per route, computed from a Next.js build manifest.
 *
 * Works even when `next build` fails at the page-data collection step, because
 * webpack has already emitted the client chunks and the manifest by then.
 *
 * Usage:
 *   node bundle-report.mjs                       # all routes, heaviest first
 *   node bundle-report.mjs dashboard             # only routes matching a substring
 *   node bundle-report.mjs dashboard --dir=.next
 *
 * Reports gzip (predicts transfer) and raw (predicts parse/compile) separately.
 */

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const args = process.argv.slice(2);
const filter = args.find((a) => !a.startsWith('--')) ?? '';
const dirArg = args.find((a) => a.startsWith('--dir='));
const NEXT_DIR = path.resolve(dirArg ? dirArg.slice('--dir='.length) : '.next');

const manifestPath = path.join(NEXT_DIR, 'build-manifest.json');
if (!fs.existsSync(manifestPath)) {
  console.error(`No build manifest at ${manifestPath}`);
  console.error('Run a production build first (it may fail late and still emit this).');
  process.exit(1);
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

const pageRoutes = Object.keys(manifest.pages ?? {}).filter((r) => !r.startsWith('/_'));
if (pageRoutes.length === 0) {
  console.error('No Pages Router routes in build-manifest.json — this looks like an App Router');
  console.error('build. Those routes live in .next/app-build-manifest.json, which this script');
  console.error('does not read yet.');
  process.exit(1);
}

const sizeCache = new Map();
function sizeOf(file) {
  if (sizeCache.has(file)) return sizeCache.get(file);
  let result = { raw: 0, gz: 0 };
  try {
    const buf = fs.readFileSync(path.join(NEXT_DIR, file));
    result = { raw: buf.length, gz: zlib.gzipSync(buf, { level: 6 }).length };
  } catch {
    /* chunk referenced but not emitted — count as zero and note it below */
  }
  sizeCache.set(file, result);
  return result;
}

const sum = (files) =>
  files.reduce(
    (acc, f) => {
      const s = sizeOf(f);
      return { raw: acc.raw + s.raw, gz: acc.gz + s.gz };
    },
    { raw: 0, gz: 0 }
  );

// Everything /_app and the root pull in is paid by every route.
const sharedFiles = [...new Set([...(manifest.rootMainFiles ?? []), ...(manifest.pages['/_app'] ?? [])])];
const shared = sum(sharedFiles);

const kb = (n) => (n / 1024).toFixed(1);
const pad = (s, n) => String(s).padStart(n);

console.log(`build dir: ${NEXT_DIR}`);
console.log('');
console.log(`SHARED BY EVERY ROUTE (/_app + root): ${kb(shared.raw)} kB raw / ${kb(shared.gz)} kB gzip`);
console.log('');
for (const f of [...sharedFiles].sort((a, b) => sizeOf(b).raw - sizeOf(a).raw)) {
  const s = sizeOf(f);
  console.log(`  ${f.replace('static/chunks/', '').padEnd(48)} ${pad(kb(s.raw) + ' kB raw', 14)} ${pad(kb(s.gz) + ' kB gz', 13)}`);
}

const rows = [];
for (const route of Object.keys(manifest.pages)) {
  if (route === '/_app') continue;
  if (filter && !route.includes(filter)) continue;
  const own = sum(manifest.pages[route].filter((f) => !sharedFiles.includes(f)));
  rows.push({
    route,
    ownGz: own.gz,
    firstGz: own.gz + shared.gz,
    firstRaw: own.raw + shared.raw,
    sharePct: ((shared.gz / (own.gz + shared.gz)) * 100).toFixed(0),
  });
}
rows.sort((a, b) => b.firstGz - a.firstGz);

console.log('');
console.log(filter ? `ROUTES MATCHING "${filter}"` : 'ALL ROUTES (heaviest first)');
console.log('');
console.log('route'.padEnd(54) + pad('own gz', 9) + pad('first gz', 11) + pad('first raw', 12) + pad('shared %', 10));
console.log('-'.repeat(96));
for (const r of rows) {
  console.log(
    r.route.padEnd(54) + pad(kb(r.ownGz), 9) + pad(kb(r.firstGz), 11) + pad(kb(r.firstRaw), 12) + pad(r.sharePct + '%', 10)
  );
}

// Context: the whole app, so a route can be judged against its peers.
const allRows = Object.keys(manifest.pages)
  .filter((r) => r !== '/_app')
  .map((r) => sum(manifest.pages[r].filter((f) => !sharedFiles.includes(f))).gz + shared.gz)
  .sort((a, b) => a - b);

if (allRows.length) {
  const median = allRows[Math.floor(allRows.length / 2)];
  console.log('');
  console.log(
    `app context: ${allRows.length} routes | median first load ${kb(median)} kB gz | ` +
      `min ${kb(allRows[0])} kB | max ${kb(allRows[allRows.length - 1])} kB`
  );
}

const missing = [...sizeCache.entries()].filter(([, v]) => v.raw === 0);
if (missing.length) {
  console.log('');
  console.log(`note: ${missing.length} manifest-referenced chunk(s) were not on disk and counted as 0 kB.`);
}

console.log('');
console.log('gzip predicts transfer time; raw predicts parse/compile time.');
console.log('Rough mid-tier mobile parse budget: ~1 MB of JS per second.');

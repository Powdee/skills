#!/usr/bin/env node
/**
 * Comparative risk profile across every domain in the codebase.
 *
 * PROVES:      which domains carry the structural risk factors that predict
 *              performance problems, so the domain under study can be ranked
 *              against its peers and the next investigation can be chosen.
 * DOES NOT     that a high-risk domain is actually slow, or that a low-risk one
 * PROVE:       is fast. These are proxies counted from source, not measurements.
 *              Only a benchmark or a trace can rank runtime cost.
 *
 * Usage:
 *   node domain-compare.mjs                     # all domains, ranked
 *   node domain-compare.mjs checkout            # highlight one domain
 *   node domain-compare.mjs checkout --root=. --domains=src/domains
 */

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const args = process.argv.slice(2);
const highlight = args.find((a) => !a.startsWith('--')) ?? null;
const opt = (n, d) => {
  const hit = args.find((a) => a.startsWith(`--${n}=`));
  return hit ? hit.slice(n.length + 3) : d;
};
const ROOT = path.resolve(opt('root', '.'));
const DOMAINS_DIR = path.join(ROOT, opt('domains', 'src/domains'));
const NEXT_DIR = path.join(ROOT, opt('next', '.next'));

// ── file walk ──────────────────────────────────────────────────────────────
const CODE = /\.(ts|tsx)$/;
const EXCLUDED = /\.(test|spec|stories|mockData)\.(ts|tsx)$/;

function walk(dir, out = []) {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return out; }
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (CODE.test(e.name)) out.push(p);
  }
  return out;
}

// ── per-domain metrics ─────────────────────────────────────────────────────
function profile(domain) {
  const dir = path.join(DOMAINS_DIR, domain);
  const all = walk(dir);
  const src = all.filter((f) => !EXCLUDED.test(f));
  const components = src.filter((f) => f.endsWith('.tsx'));

  let loc = 0;
  let memoFiles = 0;
  let virtualised = 0;
  let dynamicImports = 0;
  let mediaQueryCalls = 0;
  let intlCalls = 0;
  let stores = 0;
  let selectorFiles = 0;
  let realtime = 0;
  let effectFetches = 0;

  for (const f of src) {
    const s = fs.readFileSync(f, 'utf8');
    loc += s.split('\n').length;

    if (f.endsWith('.tsx') && /\bmemo\(/.test(s)) memoFiles += 1;
    if (/react-virtual|react-window|useVirtualizer/.test(s)) virtualised += 1;
    dynamicImports += (s.match(/next\/dynamic|(?<!\.)\bimport\s*\(/g) ?? []).length;
    mediaQueryCalls += (s.match(/\buseIs(?:Mobile|Tablet|Desktop|Breakpoint)\s*\(/g) ?? []).length;
    intlCalls += (s.match(/toLocaleDateString|toLocaleTimeString|toLocaleString|new Intl\./g) ?? []).length;
    if (/\.store\.ts$/.test(f)) stores += 1;
    if (/\.selectors\.ts$/.test(f)) selectorFiles += 1;
    if (/websocket|socket\.io|EventSource|refetchInterval|subscribeTo/i.test(s)) realtime += 1;
    if (/useEffect\([\s\S]{0,400}?(fetch\(|axios\.|\.get\()/.test(s)) effectFetches += 1;
  }

  const memoCoverage = components.length ? memoFiles / components.length : 0;

  return {
    domain,
    files: src.length,
    loc,
    components: components.length,
    memoCoverage,
    virtualised,
    dynamicImports,
    mediaQueryCalls,
    mqPerComponent: components.length ? mediaQueryCalls / components.length : 0,
    intlCalls,
    stores,
    selectorFiles,
    realtime,
    effectFetches,
  };
}

// ── route weight from the build manifest, grouped by top-level segment ──────
function routeWeights() {
  const mp = path.join(NEXT_DIR, 'build-manifest.json');
  if (!fs.existsSync(mp)) return null;
  const m = JSON.parse(fs.readFileSync(mp, 'utf8'));
  const shared = new Set([...(m.rootMainFiles ?? []), ...(m.pages['/_app'] ?? [])]);
  const gz = (f) => {
    try { return zlib.gzipSync(fs.readFileSync(path.join(NEXT_DIR, f)), { level: 6 }).length; }
    catch { return 0; }
  };
  const bySeg = new Map();
  for (const route of Object.keys(m.pages)) {
    if (route === '/_app') continue;
    const seg = route.split('/')[1] || '(root)';
    const own = m.pages[route].filter((f) => !shared.has(f)).reduce((a, f) => a + gz(f), 0);
    const cur = bySeg.get(seg) ?? { seg, routes: 0, maxOwn: 0, sumOwn: 0 };
    cur.routes += 1;
    cur.sumOwn += own;
    cur.maxOwn = Math.max(cur.maxOwn, own);
    bySeg.set(seg, cur);
  }
  return bySeg;
}

// ── risk scoring ───────────────────────────────────────────────────────────
/**
 * Each factor is a binary/graded risk flag, not a weight in a performance model.
 * The score is a count of flags raised — deliberately crude, so it cannot be
 * mistaken for a measurement.
 */
function riskFlags(p, weights) {
  const flags = [];
  if (p.components >= 25 && p.virtualised === 0) flags.push('no-virtualisation');
  if (p.dynamicImports === 0 && p.loc > 3000) flags.push('no-code-splitting');
  if (p.memoCoverage < 0.3 && p.components >= 15) flags.push('low-memo-coverage');
  if (p.mqPerComponent > 0.4) flags.push('media-query-per-component');
  if (p.realtime >= 3) flags.push('realtime-surface');
  if (p.intlCalls >= 8) flags.push('heavy-date-formatting');
  if (p.effectFetches >= 1) flags.push('effect-fetching');
  const w = weights?.get(p.domain);
  if (w && w.maxOwn / 1024 > 200) flags.push('heavy-route-chunk');
  return flags;
}

// ── run ────────────────────────────────────────────────────────────────────
if (!fs.existsSync(DOMAINS_DIR)) {
  console.error(`No domains directory at ${DOMAINS_DIR} — pass --domains=<path>`);
  process.exit(1);
}

const domains = fs
  .readdirSync(DOMAINS_DIR, { withFileTypes: true })
  .filter((e) => e.isDirectory())
  .map((e) => e.name);

const weights = routeWeights();
const rows = domains.map(profile).filter((p) => p.loc > 0);
for (const r of rows) r.flags = riskFlags(r, weights);

rows.sort((a, b) => b.loc - a.loc);

const pad = (s, n) => String(s).padEnd(n);
const rpad = (s, n) => String(s).padStart(n);
const pct = (n) => `${Math.round(n * 100)}%`;

console.log(`domains dir: ${path.relative(ROOT, DOMAINS_DIR)}`);
console.log(`${rows.length} domains with code${weights ? '' : '  (no build manifest — route weights omitted)'}`);
console.log('');
console.log(
  pad('domain', 22) + rpad('LOC', 8) + rpad('cmp', 6) + rpad('memo', 7) +
  rpad('virt', 6) + rpad('dyn', 5) + rpad('mq/cmp', 8) + rpad('intl', 6) +
  rpad('stores', 8) + rpad('rt', 4) + '  flags'
);
console.log('-'.repeat(120));

for (const r of rows.slice(0, 24)) {
  const mark = highlight && r.domain === highlight ? '►' : ' ';
  console.log(
    mark + pad(r.domain, 21) + rpad(r.loc.toLocaleString(), 8) + rpad(r.components, 6) +
    rpad(pct(r.memoCoverage), 7) + rpad(r.virtualised ? 'yes' : '—', 6) +
    rpad(r.dynamicImports || '—', 5) + rpad(r.mqPerComponent.toFixed(2), 8) +
    rpad(r.intlCalls, 6) + rpad(r.stores, 8) + rpad(r.realtime, 4) +
    '  ' + r.flags.length
  );
}

console.log('');
console.log('Ranked by risk-flag count (crude — a count of flags raised, not a score):');
console.log('');
const byRisk = [...rows].sort((a, b) => b.flags.length - a.flags.length || b.loc - a.loc);
for (const r of byRisk.slice(0, 12)) {
  const mark = highlight && r.domain === highlight ? '► ' : '  ';
  console.log(`${mark}${pad(r.domain, 20)} ${r.flags.length}  ${r.flags.join(', ') || '—'}`);
}

if (weights) {
  console.log('');
  console.log('Route chunk weight by top-level path segment (own code, excludes shared bundle):');
  console.log('');
  console.log(pad('segment', 22) + rpad('routes', 8) + rpad('heaviest kB gz', 16));
  console.log('-'.repeat(48));
  for (const w of [...weights.values()].sort((a, b) => b.maxOwn - a.maxOwn).slice(0, 14)) {
    console.log(pad(w.seg, 22) + rpad(w.routes, 8) + rpad((w.maxOwn / 1024).toFixed(1), 16));
  }
}

if (highlight) {
  const me = rows.find((r) => r.domain === highlight);
  if (me) {
    const rank = (key, desc = true) => {
      // Array-valued metrics (flags) rank by length; subtracting arrays yields
      // NaN, which leaves the sort untouched and reports the previous order.
      const val = (r) => (Array.isArray(r[key]) ? r[key].length : r[key]);
      const sorted = [...rows].sort((a, b) =>
        desc ? val(b) - val(a) : val(a) - val(b),
      );
      return sorted.findIndex((r) => r.domain === highlight) + 1;
    };
    console.log('');
    console.log(`── ${highlight} in context of ${rows.length} domains ──`);
    console.log(`  size:            #${rank('loc')} by LOC (${me.loc.toLocaleString()})`);
    console.log(`  components:      #${rank('components')} (${me.components})`);
    console.log(`  memo coverage:   ${pct(me.memoCoverage)} vs codebase median ${pct(median(rows.map((r) => r.memoCoverage)))}`);
    console.log(`  media queries:   ${me.mqPerComponent.toFixed(2)}/component vs median ${median(rows.map((r) => r.mqPerComponent)).toFixed(2)}`);
    console.log(`  risk flags:      ${me.flags.length} (#${rank('flags')} — ${me.flags.join(', ') || 'none'})`);
    console.log('');
    console.log('  Reminder: flags predict where to look, not what is slow. Benchmark before acting.');
  }
}

function median(xs) {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? s[Math.floor(s.length / 2)] : 0;
}

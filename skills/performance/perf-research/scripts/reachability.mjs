#!/usr/bin/env node
/**
 * Static reachability walk from an entry file.
 *
 * Answers: which node_modules packages land in the EAGER bundle for this entry,
 * which are already code-split behind `import()`, and — for the heavy ones — the
 * exact import chain that drags them in.
 *
 * Usage:
 *   node reachability.mjs src/pages/_app.tsx
 *   node reachability.mjs src/pages/dashboard/index.tsx --alias=~=src --top=25
 *
 * Deliberately simple: regex import extraction plus extension probing. It is a
 * reachability oracle, not a bundler. Installed package size is reported as an
 * UPPER BOUND — tree-shaking may exclude most of it.
 */

import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const entryArg = args.find((a) => !a.startsWith('--'));
if (!entryArg) {
  console.error('usage: node reachability.mjs <entry-file> [--alias=~=src] [--top=25] [--root=.]');
  process.exit(1);
}

const opt = (name, fallback) => {
  const hit = args.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
};

const ROOT = path.resolve(opt('root', '.'));
const TOP = Number(opt('top', 25));
const [aliasPrefix, aliasTarget] = opt('alias', '~=src').split('=');
const ALIAS_DIR = path.join(ROOT, aliasTarget);
const EXTS = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'];

const STATIC_RE =
  /(?:^|\n)\s*(?:import\s+(?:[\s\S]*?)\s+from\s*|import\s*|export\s+(?:\*|\{[\s\S]*?\})\s+from\s*)['"]([^'"]+)['"]/g;
const DYNAMIC_RE = /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
const IGNORE_EXT = ['.css', '.scss', '.svg', '.png', '.jpg', '.json', '.webp', '.woff', '.woff2'];

function resolveLocal(spec, fromFile) {
  let base;
  if (spec.startsWith(`${aliasPrefix}/`)) base = path.join(ALIAS_DIR, spec.slice(aliasPrefix.length + 1));
  else if (spec.startsWith('.')) base = path.resolve(path.dirname(fromFile), spec);
  else return null;

  for (const e of EXTS) if (fs.existsSync(base + e)) return base + e;
  if (fs.existsSync(base)) {
    const st = fs.statSync(base);
    if (st.isDirectory()) {
      for (const e of EXTS) {
        const idx = path.join(base, `index${e}`);
        if (fs.existsSync(idx)) return idx;
      }
      return null;
    }
    return base;
  }
  return null;
}

const packageOf = (spec) =>
  spec.startsWith('@') ? spec.split('/').slice(0, 2).join('/') : spec.split('/')[0];

const BUILTIN = new Set(['next', 'react', 'react-dom']);

const eager = new Map(); // pkg -> import chain
const split = new Map();
const visited = new Set();
let localModules = 0;

function walk(file, chain, inDynamicBranch) {
  if (visited.has(file)) return;
  visited.add(file);
  localModules += 1;

  let src;
  try {
    src = fs.readFileSync(file, 'utf8');
  } catch {
    return;
  }

  const rel = path.relative(ROOT, file);

  const collect = (re, isDynamicEdge) => {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(src)) !== null) {
      const spec = m[1];
      if (spec.startsWith('node:')) continue;
      if (IGNORE_EXT.some((e) => spec.endsWith(e))) continue;

      const local = resolveLocal(spec, file);
      if (local) {
        walk(local, [...chain, rel], inDynamicBranch || isDynamicEdge);
        continue;
      }
      const pkg = packageOf(spec);
      if (BUILTIN.has(pkg)) continue;
      const bucket = inDynamicBranch || isDynamicEdge ? split : eager;
      if (!bucket.has(pkg)) bucket.set(pkg, [...chain, rel, spec]);
    }
  };

  collect(STATIC_RE, false);
  collect(DYNAMIC_RE, true);
}

const entry = path.resolve(ROOT, entryArg);
if (!fs.existsSync(entry)) {
  console.error(`entry not found: ${entry}`);
  process.exit(1);
}
walk(entry, [], false);

function dirSizeKb(dir) {
  let total = 0;
  const stack = [dir];
  while (stack.length) {
    const cur = stack.pop();
    let st;
    try {
      st = fs.statSync(cur);
    } catch {
      continue;
    }
    if (st.isDirectory()) for (const e of fs.readdirSync(cur)) stack.push(path.join(cur, e));
    else total += st.size;
  }
  return Math.round(total / 1024);
}

const rows = [...eager.keys()]
  .map((pkg) => {
    const dir = path.join(ROOT, 'node_modules', pkg);
    return { pkg, kb: fs.existsSync(dir) ? dirSizeKb(dir) : 0 };
  })
  .sort((a, b) => b.kb - a.kb);

console.log(`entry: ${path.relative(ROOT, entry)}`);
console.log(`first-party modules statically reachable: ${localModules}`);
console.log(`third-party packages EAGER (in the shared bundle): ${eager.size}`);
console.log(`third-party packages code-split (import() only):   ${split.size}`);
console.log('');
console.log(`Heaviest EAGER packages — installed size is an UPPER BOUND, not bundled size:`);
console.log('');
console.log('package'.padEnd(42) + 'installed');
console.log('-'.repeat(56));
for (const r of rows.slice(0, TOP)) console.log(r.pkg.padEnd(42) + `${r.kb} kB`);

if (split.size) {
  console.log('');
  console.log('Already code-split:');
  for (const pkg of split.keys()) console.log(`  ${pkg}`);
}

console.log('');
console.log('Import chains for the heaviest eager packages (the edge to cut):');
for (const r of rows.slice(0, Math.min(8, rows.length))) {
  const chain = eager.get(r.pkg);
  console.log('');
  console.log(`  ${r.pkg}`);
  console.log('    ' + chain.slice(-4).join('\n      -> '));
}

console.log('');
console.log('Verify a package really is in the emitted chunk before quoting bytes:');
console.log('substring-grepping minified chunks yields false positives.');

// Brings EDS blocks from the Radix design system hub into this site's blocks/ folder.
// Run by .github/workflows/ds-sync.yml, which opens a pull request with the result.
//   node scripts/ds-sync.mjs            sync
//   DS_URL=http://localhost:3016/ node scripts/ds-sync.mjs   test against a local hub
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const lockPath = join(ROOT, 'ds.lock.json');
const lock = existsSync(lockPath) ? JSON.parse(readFileSync(lockPath, 'utf8')) : { hub: '', version: null, blocks: {} };
const hub = (process.env.DS_URL || lock.hub).replace(/\/?$/, '/');
if (!hub) throw new Error('No design system URL: set "hub" in ds.lock.json or DS_URL');

const get = async (url) => { const r = await fetch(url, { cache: 'no-store' }); if (!r.ok) throw new Error(`${url}: ${r.status}`); return r; };
const registry = await (await get(`${hub}registry.json`)).json();
const changes = await (await get(`${hub}changes.json`)).json().catch(() => null);

const NAME = /^[a-z0-9-]+$/; const FILE = /^[\w.-]+\.(js|css)$/;
const added = []; const updated = []; const removed = [];

for (const b of registry.blocks) {
  if (!NAME.test(b.name)) continue;
  const known = lock.blocks[b.name];
  if (known?.hash === b.hash) continue;
  mkdirSync(join(ROOT, 'blocks', b.name), { recursive: true });
  for (const f of b.files.filter((x) => FILE.test(x))) {
    writeFileSync(join(ROOT, 'blocks', b.name, f), await (await get(`${hub}eds/blocks/${b.name}/${f}`)).text());
  }
  (known ? updated : added).push(b);
  lock.blocks[b.name] = { hash: b.hash, version: registry.version };
}
Object.keys(lock.blocks).filter((n) => !registry.blocks.find((b) => b.name === n)).forEach((n) => removed.push(n));

const from = lock.version;
lock.hub = lock.hub || hub; lock.version = registry.version; // a DS_URL override is for testing only
writeFileSync(lockPath, `${JSON.stringify(lock, null, 2)}\n`);

const list = (title, items) => (items.length ? [`**${title}**`, ...items.map((i) => `- ${i}`), ''] : []);
const summary = [
  `## Design system sync: ${from || 'new'} → ${registry.version}`, '',
  ...list('New blocks', added.map((b) => `\`${b.name}\` (${b.status}): ${b.description}`)),
  ...list('Updated blocks', updated.map((b) => `\`${b.name}\``)),
  ...list('Removed from the design system (not deleted here, remove manually if intended)', removed.map((n) => `\`${n}\``)),
  ...list('Token changes already live on the site (no code needed)', (changes?.tokenChanges || []).map((t) => `${t.brand} \`${t.field}\`: ${t.from} → ${t.to} (affects ${t.affectedBlocks.join(', ') || 'no blocks'})`)),
  `Source: ${hub}`,
].join('\n');
writeFileSync(join(ROOT, 'ds-sync-summary.md'), `${summary}\n`);
console.log(summary);

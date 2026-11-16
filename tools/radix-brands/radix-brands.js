import { ACCENTS, GRAYS, RADII, sourceOf } from '/scripts/radix-theme.js';

let sdk = null;
const state = { brands: [], blocks: [], data: {}, current: null };

async function loadSdk() {
  try {
    const mod = await import('https://da.live/nx/utils/sdk.js');
    sdk = await Promise.race([mod.default, new Promise((r) => { setTimeout(() => r(null), 2000); })]);
  } catch (e) { sdk = null; }
}

const $ = (s) => document.querySelector(s);
const el = (t, props = {}, ...kids) => { const n = Object.assign(document.createElement(t), props); n.append(...kids); return n; };

// ---- live update of the editor view ----
function allFrames(win, out = []) {
  try { for (let i = 0; i < win.length; i += 1) { out.push(win[i]); allFrames(win[i], out); } } catch (e) { /* inaccessible */ }
  return out;
}
function broadcast(theme) {
  let top = window;
  try { top = window.top; } catch (e) { /* use self */ }
  const own = allFrames(window); // this app's own gallery iframes get their own messages
  allFrames(top).filter((f) => f !== window && !own.includes(f))
    .forEach((f) => { try { f.postMessage({ type: 'radix-brands:theme', theme }, '*'); } catch (e) { /* ignore */ } });
}

// ---- designer ----
function sendTheme(brand) {
  broadcast(state.data[brand].theme);
  document.querySelectorAll('#previews iframe').forEach((f) => {
    if (f.dataset.brand === brand) f.contentWindow.postMessage({ type: 'radix-brands:theme', theme: state.data[brand].theme }, '*');
  });
}

const FIELDS = [
  { key: 'accentColor', label: 'Accent color', options: ACCENTS },
  { key: 'grayColor', label: 'Gray color', options: GRAYS },
  { key: 'radius', label: 'Radius', options: RADII },
  { key: 'appearance', label: 'Appearance', options: ['light', 'dark'] },
  { key: 'scaling', label: 'Scaling (e.g. 100%)' },
  { key: 'headingFont', label: 'Heading font' },
  { key: 'bodyFont', label: 'Body font' },
  { key: 'headingTracking', label: 'Heading letter-spacing' },
  { key: 'headingTransform', label: 'Heading case', options: ['none', 'uppercase', 'capitalize'] },
];

function renderControls() {
  const { theme } = state.data[state.current];
  const box = $('#controls'); box.replaceChildren();
  FIELDS.forEach((f) => {
    const input = f.options
      ? el('select', {}, el('option', { value: '', textContent: '(not set)' }), ...f.options.map((o) => el('option', { value: o, textContent: o })))
      : el('input', { type: 'text' });
    input.value = theme[f.key] ?? '';
    input.addEventListener('input', () => {
      if (input.value === '') delete theme[f.key]; else theme[f.key] = input.value;
      sendTheme(state.current);
    });
    box.append(el('label', {}, f.label, input));
  });
}

function renderPreviews() {
  const brands = [state.current];
  if ($('#compare').checked) brands.push(state.brands.find((b) => b !== state.current));
  $('#previews').replaceChildren(...brands.map((b) => {
    const f = el('iframe', { src: `/tools/radix-brands/gallery.html?brand=${b}`, title: b });
    f.dataset.brand = b;
    return f;
  }));
}

async function save() {
  const status = $('#saveStatus');
  const [owner, repo] = ($('#repo').value || '').split('/');
  const token = $('#pat').value;
  if (!owner || !repo || !token) { status.textContent = 'Repo and token are required.'; return; }
  try { localStorage.setItem('radix-brands-repo', $('#repo').value); } catch (e) { /* ignore */ }
  const api = `https://api.github.com/repos/${owner}/${repo}`;
  const h = { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' };
  let branch = `radix-brands/${state.current}-theme`;
  const direct = $('#direct').checked;
  const path = `tokens/${state.current}.json`;
  try {
    const repoInfo = await (await fetch(api, { headers: h })).json();
    if (direct) branch = repoInfo.default_branch;
    else {
      const base = await (await fetch(`${api}/git/ref/heads/${repoInfo.default_branch}`, { headers: h })).json();
      const mk = await fetch(`${api}/git/refs`, { method: 'POST', headers: h, body: JSON.stringify({ ref: `refs/heads/${branch}`, sha: base.object.sha }) });
      if (!mk.ok && mk.status !== 422) throw new Error(`branch: ${mk.status}`);
    }
    const cur = await fetch(`${api}/contents/${path}?ref=${branch}&_=${Date.now()}`, { headers: h, cache: 'no-store' });
    const sha = cur.ok ? (await cur.json()).sha : undefined;
    const content = btoa(unescape(encodeURIComponent(`${JSON.stringify(state.data[state.current], null, 2)}\n`)));
    const put = await fetch(`${api}/contents/${path}`, { method: 'PUT', headers: h, body: JSON.stringify({ message: `Update ${state.current} Radix theme`, branch, sha, content }) });
    if (!put.ok) throw new Error(`commit: ${put.status}`);
    if (direct) { status.textContent = `Saved ${path} to ${branch}. The site updates after Code Sync.`; return; }
    status.replaceChildren('Saved. ', el('a', { href: `https://github.com/${owner}/${repo}/compare/${repoInfo.default_branch}...${branch}?expand=1`, target: '_blank', textContent: 'Open pull request' }));
  } catch (e) { status.textContent = `Save failed: ${e.message}`; }
}

// ---- parity ----
async function renderParity() {
  const used = {};
  await Promise.all(state.blocks.map(async (b) => {
    const css = await (await fetch(`/blocks/${b}/${b}.css`)).text();
    const vars = [...new Set([...css.matchAll(/var\((--(?:brand|accent|gray)-[\w-]+)/g)].map((m) => m[1]))];
    used[b] = { keys: [...new Set(vars.map(sourceOf).filter(Boolean))], hardcoded: (css.match(/#[0-9a-f]{3,8}\b|rgba?\(/gi) || []).length };
  }));
  const table = el('table');
  table.append(el('tr', {}, el('th', { textContent: 'Block' }), ...state.brands.map((b) => el('th', { textContent: state.data[b].name }))));
  state.blocks.forEach((b) => {
    const tr = el('tr', {}, el('th', {}, b, el('small', { textContent: `needs: ${used[b].keys.join(', ')}` })));
    state.brands.forEach((br) => {
      const missing = used[b].keys.filter((k) => !(k in state.data[br].theme));
      const bad = missing.length || used[b].hardcoded;
      const note = [missing.length && `missing: ${missing.join(', ')}`, used[b].hardcoded && `${used[b].hardcoded} hardcoded color(s)`].filter(Boolean).join(' · ');
      tr.append(el('td', { className: bad ? 'bad' : 'ok' }, bad ? '✗ ' : '✓ ', el('small', { textContent: note || 'full parity' })));
    });
    table.append(tr);
  });
  const all = new Set(Object.values(used).flatMap((u) => u.keys));
  const score = state.brands.map((br) => `${state.data[br].name} ${Math.round((100 * [...all].filter((k) => k in state.data[br].theme).length) / all.size)}%`);
  $('#matrix').replaceChildren(el('p', { textContent: `Theme coverage: ${score.join(' · ')}` }), table);
}

async function init() {
  loadSdk().then(() => { if (sdk && !$('#repo').value) $('#repo').value = `${sdk.context.org}/${sdk.context.repo}`; });
  const cfg = await (await fetch('/tokens/brands.json')).json();
  state.brands = cfg.brands; state.blocks = cfg.blocks;
  await Promise.all(state.brands.map(async (b) => { state.data[b] = await (await fetch(`/tokens/${b}.json`)).json(); }));
  state.current = state.brands[0];
  const sel = $('#brand');
  state.brands.forEach((b) => sel.append(el('option', { value: b, textContent: state.data[b].name })));
  sel.addEventListener('change', () => { state.current = sel.value; renderControls(); renderPreviews(); broadcast(state.data[state.current].theme); });
  $('#compare').addEventListener('change', renderPreviews);
  $('#save').addEventListener('click', save);
  try { $('#repo').value = localStorage.getItem('radix-brands-repo') || ''; } catch (e) { /* ignore */ }
  document.querySelectorAll('nav button').forEach((b) => b.addEventListener('click', () => {
    document.querySelectorAll('nav button').forEach((x) => x.classList.toggle('active', x === b));
    $('#designer').hidden = b.dataset.tab !== 'designer'; $('#parity').hidden = b.dataset.tab !== 'parity';
    if (b.dataset.tab === 'parity') renderParity();
  }));
  renderControls(); renderPreviews();
}
init();

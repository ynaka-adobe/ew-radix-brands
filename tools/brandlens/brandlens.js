const COLOR = /^#[0-9a-f]{6}$/i;
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

// ---- contrast ----
const lum = (hex) => {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
function warnings(tokens) {
  const pairs = [['--brand-accent-contrast', '--brand-accent'], ['--brand-text', '--brand-surface'], ['--brand-text-muted', '--brand-surface-alt']];
  return pairs.filter(([a, b]) => COLOR.test(tokens[a]) && COLOR.test(tokens[b]) && ratio(tokens[a], tokens[b]) < 4.5)
    .map(([a, b]) => `${a.replace('--brand-', '')} on ${b.replace('--brand-', '')}: ${ratio(tokens[a], tokens[b]).toFixed(1)}:1 fails AA`);
}

// ---- designer ----
function sendTokens(brand) {
  document.querySelectorAll('#previews iframe').forEach((f) => {
    if (f.dataset.brand === brand) f.contentWindow.postMessage({ type: 'brandlens:tokens', tokens: state.data[brand].tokens }, '*');
  });
}
function renderControls() {
  const { tokens } = state.data[state.current];
  const box = $('#controls'); box.replaceChildren();
  Object.entries(tokens).forEach(([k, v]) => {
    const input = el('input', { value: v, type: COLOR.test(v) ? 'color' : 'text' });
    input.addEventListener('input', () => {
      tokens[k] = input.value; sendTokens(state.current); renderWarnings();
    });
    box.append(el('label', {}, k.replace('--brand-', ''), input));
  });
  renderWarnings();
}
function renderWarnings() {
  $('#warnings').replaceChildren(...warnings(state.data[state.current].tokens).map((w) => el('div', { textContent: w })));
}
function renderPreviews() {
  const brands = [state.current];
  if ($('#compare').checked) brands.push(state.brands.find((b) => b !== state.current));
  $('#previews').replaceChildren(...brands.map((b) => el('iframe', { src: `/tools/brandlens/gallery.html?brand=${b}`, title: b, 'data-brand': b })));
}
async function save() {
  const status = $('#saveStatus');
  const [owner, repo] = ($('#repo').value || '').split('/');
  const token = $('#pat').value;
  if (!owner || !repo || !token) { status.textContent = 'Repo and token are required.'; return; }
  try { localStorage.setItem('brandlens-repo', $('#repo').value); } catch (e) { /* ignore */ }
  const api = `https://api.github.com/repos/${owner}/${repo}`;
  const h = { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' };
  const branch = `brandlens/${state.current}-tokens`;
  const path = `tokens/${state.current}.json`;
  try {
    const repoInfo = await (await fetch(api, { headers: h })).json();
    const base = await (await fetch(`${api}/git/ref/heads/${repoInfo.default_branch}`, { headers: h })).json();
    const mk = await fetch(`${api}/git/refs`, { method: 'POST', headers: h, body: JSON.stringify({ ref: `refs/heads/${branch}`, sha: base.object.sha }) });
    if (!mk.ok && mk.status !== 422) throw new Error(`branch: ${mk.status}`);
    const cur = await fetch(`${api}/contents/${path}?ref=${branch}`, { headers: h });
    const sha = cur.ok ? (await cur.json()).sha : undefined;
    const body = { message: `BrandLens: update ${state.current} tokens`, branch, sha, content: btoa(unescape(encodeURIComponent(`${JSON.stringify(state.data[state.current], null, 2)}\n`))) };
    const put = await fetch(`${api}/contents/${path}`, { method: 'PUT', headers: h, body: JSON.stringify(body) });
    if (!put.ok) throw new Error(`commit: ${put.status}`);
    status.replaceChildren('Saved. ', el('a', { href: `https://github.com/${owner}/${repo}/compare/${repoInfo.default_branch}...${branch}?expand=1`, target: '_blank', textContent: 'Open pull request' }));
  } catch (e) { status.textContent = `Save failed: ${e.message}`; }
}

// ---- parity ----
async function renderParity() {
  const used = {};
  await Promise.all(state.blocks.map(async (b) => {
    const css = await (await fetch(`/blocks/${b}/${b}.css`)).text();
    used[b] = { vars: [...new Set([...css.matchAll(/var\((--brand-[\w-]+)/g)].map((m) => m[1]))], hardcoded: (css.match(/#[0-9a-f]{3,8}\b|rgba?\(/gi) || []).length };
  }));
  const table = el('table');
  table.append(el('tr', {}, el('th', { textContent: 'Block' }), ...state.brands.map((b) => el('th', { textContent: state.data[b].name }))));
  state.blocks.forEach((b) => {
    const tr = el('tr', {}, el('th', {}, b, el('small', { textContent: `${used[b].vars.length} tokens` })));
    state.brands.forEach((br) => {
      const missing = used[b].vars.filter((v) => !(v in state.data[br].tokens));
      const bad = missing.length || used[b].hardcoded;
      const note = [missing.length && `missing: ${missing.join(', ')}`, used[b].hardcoded && `${used[b].hardcoded} hardcoded color(s)`].filter(Boolean).join(' · ');
      tr.append(el('td', { className: bad ? 'bad' : 'ok' }, bad ? '✗ ' : '✓ ', el('small', { textContent: note || 'full parity' })));
    });
    table.append(tr);
  });
  const score = state.brands.map((br) => {
    const all = new Set(Object.values(used).flatMap((u) => u.vars));
    const have = [...all].filter((v) => v in state.data[br].tokens).length;
    return `${state.data[br].name} ${Math.round((100 * have) / all.size)}%`;
  });
  $('#matrix').replaceChildren(el('p', { textContent: `Token coverage: ${score.join(' · ')}` }), table);
}

async function init() {
  const sdkReady = loadSdk().then(() => {
    if (sdk && !$('#repo').value) $('#repo').value = `${sdk.context.org}/${sdk.context.repo}`;
  });
  const cfg = await (await fetch('/tokens/brands.json')).json();
  state.brands = cfg.brands; state.blocks = cfg.blocks;
  await Promise.all(state.brands.map(async (b) => { state.data[b] = await (await fetch(`/tokens/${b}.json`)).json(); }));
  state.current = state.brands[0];
  const sel = $('#brand');
  state.brands.forEach((b) => sel.append(el('option', { value: b, textContent: state.data[b].name })));
  sel.addEventListener('change', () => { state.current = sel.value; renderControls(); renderPreviews(); });
  $('#compare').addEventListener('change', renderPreviews);
  $('#save').addEventListener('click', save);
  let remembered = '';
  try { remembered = localStorage.getItem('brandlens-repo') || ''; } catch (e) { /* ignore */ }
  $('#repo').value = remembered;  document.querySelectorAll('nav button').forEach((b) => b.addEventListener('click', () => {
    document.querySelectorAll('nav button').forEach((x) => x.classList.toggle('active', x === b));
    $('#designer').hidden = b.dataset.tab !== 'designer'; $('#parity').hidden = b.dataset.tab !== 'parity';
    if (b.dataset.tab === 'parity') renderParity();
  }));
  renderControls(); renderPreviews();
}
init();

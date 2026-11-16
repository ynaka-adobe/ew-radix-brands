import { fieldOf, dsBranch } from '/scripts/radix-theme.js';
import { loadDesignSystem, showInEditor, ownFrames } from '/tools/radix-brands/shared.js';

const $ = (s) => document.querySelector(s);
const el = (t, props = {}, ...kids) => { const n = Object.assign(document.createElement(t), props); n.append(...kids); return n; };
const get = (obj, path) => path.split('.').reduce((o, k) => o?.[k], obj);
const state = { ds: null, current: null };
const RAW = 'https://raw.githubusercontent.com/ynaka-adobe/radix-design-system/';
const rawBase = (branch) => `${RAW}${branch}/public/`;
const isLocal = (base) => ['localhost', '127.0.0.1'].includes(new URL(base).hostname);
const dsParam = () => (dsBranch(state.ds.base) ? `&ds=${encodeURIComponent(state.ds.base)}` : '');

/** Where a block's CSS comes from: the previewed design system branch, else this site. */
async function blockCss(n) {
  const { base } = state.ds;
  const url = base.startsWith(RAW) ? new URL(`../eds/blocks/${n}/${n}.css`, base) : isLocal(base) ? new URL(`eds/blocks/${n}/${n}.css`, base) : null;
  if (url) { const r = await fetch(url, { cache: 'no-cache' }).catch(() => null); if (r?.ok) return r.text(); }
  const site = await fetch(`/blocks/${n}/${n}.css`);
  return site.ok ? site.text() : '';
}

/** Authors choose the live design system or a branch a designer or developer has created. */
async function initSource() {
  const sel = $('#dsSource');
  const current = dsBranch(state.ds.base);
  try {
    const r = await fetch('https://api.github.com/repos/ynaka-adobe/radix-design-system/branches?per_page=100');
    const names = r.ok ? (await r.json()).map((b) => b.name).filter((n) => n !== 'main') : [];
    names.forEach((n) => sel.append(el('option', { value: n, textContent: `Branch: ${n}` })));
    if (current && current !== 'local' && !names.includes(current)) sel.append(el('option', { value: current, textContent: `Branch: ${current}` }));
  } catch (e) { /* offline: live only */ }
  if (current === 'local') sel.append(el('option', { value: 'local', textContent: 'Local design system' }));
  sel.value = current || '';
  sel.addEventListener('change', () => {
    // The ?ds= parameter wins over stored state, so set it explicitly and reload.
    const url = new URL(window.location.href);
    url.searchParams.set('ds', !sel.value ? 'live' : sel.value === 'local' ? state.ds.base : rawBase(sel.value));
    window.location.href = url.href;
  });
}
function renderOpenPage() {
  const q = dsBranch(state.ds.base) ? `?ds=${encodeURIComponent(state.ds.base)}&brand=${state.current}` : `?ds=live&brand=${state.current}`;
  $('#openPage').href = `${window.location.origin}/${q}`;
}

function renderSummary() {
  const b = state.ds.brands[state.current];
  const rows = (title, obj) => [el('h2', { textContent: title }), el('dl', {}, ...Object.entries(obj).flatMap(([k, v]) => [el('dt', { textContent: k }), el('dd', { textContent: v })]))];
  $('#summary').replaceChildren(...rows('Theme', b.theme), ...rows('Typography', b.typography), ...rows('Layout', b.layout), ...(Object.keys(b.tokens || {}).length ? rows('Custom tokens', b.tokens) : []));
}

function renderPreviews() {
  const ids = [state.current];
  if ($('#compare').checked) ids.push(Object.keys(state.ds.brands).find((b) => b !== state.current));
  $('#previews').replaceChildren(...ids.map((id) => el('iframe', { src: `/tools/radix-brands/gallery.html?brand=${id}${dsParam()}`, title: id })));
}

function select(id, send = true) {
  state.current = id;
  document.querySelectorAll('#brandList button').forEach((b) => b.classList.toggle('active', b.dataset.id === id));
  renderSummary(); renderPreviews(); renderOpenPage();
  if (!send) return;
  $('#status').textContent = 'Showing in the editor view…';
  showInEditor(state.ds.brands[id], state.ds.manifest.tokensCss, ({ reached, acks }) => {
    $('#status').textContent = acks
      ? `Showing ${state.ds.brands[id].name} in ${acks} editor view${acks > 1 ? 's' : ''}.`
      : `No page responded (reached ${reached} frame${reached === 1 ? '' : 's'}). The editor view may need a refresh, or this site does not load brand.js.`;
  }, ownFrames());
}

async function renderParity() {
  const { brands, manifest } = state.ds;
  const blocks = Object.keys(manifest.blocks || { hero: 1, cards: 1, teaser: 1, button: 1 });
  const used = {};
  await Promise.all(blocks.map(async (b) => {
    const css = await blockCss(b);
    const fields = [...new Set([...css.matchAll(/var\((--[\w-]+)/g)].map((m) => fieldOf(m[1])).filter(Boolean))];
    used[b] = { absent: !css.trim(), fields, hardcoded: (css.replace(/var\([^)]*\)/g, '').match(/#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(/gi) || []).length };
  }));
  const ids = Object.keys(brands);
  const table = el('table', {}, el('tr', {}, el('th', { textContent: 'Block' }), ...ids.map((i) => el('th', { textContent: brands[i].name }))));
  blocks.forEach((b) => {
    const tr = el('tr', {}, el('th', {}, b, el('small', { textContent: used[b].absent ? 'not on this site yet' : `needs: ${used[b].fields.join(', ')}` })));
    ids.forEach((i) => {
      if (used[b].absent) { tr.append(el('td', { className: 'na' }, '– ', el('small', { textContent: 'not synced, nothing to check' }))); return; }
      const missing = used[b].fields.filter((f) => !get(brands[i], f));
      const bad = missing.length || used[b].hardcoded;
      const note = [missing.length && `missing: ${missing.join(', ')}`, used[b].hardcoded && `${used[b].hardcoded} hardcoded value(s)`].filter(Boolean).join(' · ');
      tr.append(el('td', { className: bad ? 'bad' : 'ok' }, bad ? '✗ ' : '✓ ', el('small', { textContent: note || 'full parity' })));
    });
    table.append(tr);
  });
  const all = [...new Set(Object.values(used).flatMap((u) => u.fields))];
  const score = ids.map((i) => `${brands[i].name} ${Math.round((100 * all.filter((f) => get(brands[i], f)).length) / all.length)}%`);
  $('#matrix').replaceChildren(el('p', { textContent: `Design system v${manifest.version}, Radix Themes ${manifest.radixThemes}. Coverage: ${score.join(' · ')}` }), table);
}

async function renderDs() {
  const { base } = state.ds;
  const json = async (u) => { const r = await fetch(u, { cache: 'no-cache' }); return r.ok ? r.json() : null; };
  const [registry, changes, lock] = await Promise.all([json(`${base}registry.json`), json(`${base}changes.json`), json('/ds.lock.json')]);
  if (!registry) { $('#dsHead').textContent = 'The design system has not published a block registry yet.'; return; }
  const synced = lock?.blocks || {};
  const outdated = registry.blocks.filter((b) => synced[b.name]?.hash !== b.hash);
  $('#dsHead').replaceChildren(
    el('p', {}, `Design system v${registry.version}`, el('br'), `This site is synced to ${lock?.version ? `v${lock.version}` : 'nothing yet'}. `,
      el('span', { className: `pill ${outdated.length ? 'bad' : 'ok'}`, textContent: outdated.length ? `${outdated.length} block${outdated.length > 1 ? 's' : ''} to sync` : 'blocks in sync' })),
  );
  const tc = changes?.tokenChanges || [];
  $('#dsTokens').replaceChildren(...(tc.length ? tc.map((t) => el('p', {}, el('b', { textContent: `${t.brand} · ${t.field}: ` }), `${t.from ?? '(none)'} → ${t.to ?? '(none)'}  affects `,
    ...(t.affectedBlocks.length ? t.affectedBlocks.map((n) => el('span', { className: 'pill', textContent: n })) : [el('span', { className: 'pill', textContent: 'no blocks' })])))
    : [el('p', { className: 'hint', textContent: changes?.from ? `No token changes since v${changes.from}.` : 'No previous version to compare yet.' })]));
  const rows = registry.blocks.map((b) => {
    const state_ = !synced[b.name] ? ['new, sync to add', 'bad'] : synced[b.name].hash !== b.hash ? ['update available', 'bad'] : ['in sync', 'ok'];
    return el('tr', {}, el('th', {}, b.title, el('small', { textContent: b.name })),
      el('td', {}, el('span', { className: 'pill', textContent: b.status })),
      el('td', {}, b.description, el('small', { textContent: b.authoring })),
      el('td', {}, ...b.fields.map((f) => el('span', { className: 'pill', textContent: f }))),
      el('td', {}, el('span', { className: `pill ${state_[1]}`, textContent: state_[0] })));
  });
  $('#dsBlocks').replaceChildren(el('table', {}, el('tr', {}, ...['Block', 'Status', 'Spec', 'Design system fields it uses', 'This site'].map((h) => el('th', { textContent: h }))), ...rows));
  $('#dsRun').onclick = async () => {
    const token = $('#dsPat').value; const repo = lock?.repo;
    if (!token || !repo) { $('#dsStatus').textContent = 'Enter a token.'; return; }
    const r = await fetch(`https://api.github.com/repos/${repo}/actions/workflows/ds-sync.yml/dispatches`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' }, body: JSON.stringify({ ref: 'main' }) });
    $('#dsStatus').textContent = r.status === 204 ? `Sync started. A pull request will appear at github.com/${repo}/pulls.` : `Could not start the sync (${r.status}).`;
  };
}

async function init() {
  try { state.ds = await loadDesignSystem(); } catch (e) {
    $('#source').textContent = `Could not load the design system (${e.message}). Check the URL in scripts/radix-theme.js.`; return;
  }
  $('#source').textContent = `Design system: ${state.ds.base}`;
  initSource();
  $('#edit').href = state.ds.base;
  Object.values(state.ds.brands).forEach((b) => {
    const btn = el('button', { textContent: b.name }); btn.dataset.id = b.id;
    btn.addEventListener('click', () => select(b.id));
    $('#brandList').append(btn);
  });
  $('#compare').addEventListener('change', renderPreviews);
  document.querySelectorAll('nav button').forEach((b) => b.addEventListener('click', () => {
    document.querySelectorAll('nav button').forEach((x) => x.classList.toggle('active', x === b));
    $('#brands').hidden = b.dataset.tab !== 'brands'; $('#parity').hidden = b.dataset.tab !== 'parity'; $('#ds').hidden = b.dataset.tab !== 'ds';
    if (b.dataset.tab === 'parity') renderParity();
    if (b.dataset.tab === 'ds') renderDs();
  }));
  select(Object.keys(state.ds.brands)[0], false);
}
init();

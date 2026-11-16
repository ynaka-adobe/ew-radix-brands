import { fieldOf } from '/scripts/radix-theme.js';
import { loadDesignSystem, showInEditor, ownFrames } from '/tools/radix-brands/shared.js';

const $ = (s) => document.querySelector(s);
const el = (t, props = {}, ...kids) => { const n = Object.assign(document.createElement(t), props); n.append(...kids); return n; };
const get = (obj, path) => path.split('.').reduce((o, k) => o?.[k], obj);
const state = { ds: null, current: null };

function renderSummary() {
  const b = state.ds.brands[state.current];
  const rows = (title, obj) => [el('h2', { textContent: title }), el('dl', {}, ...Object.entries(obj).flatMap(([k, v]) => [el('dt', { textContent: k }), el('dd', { textContent: v })]))];
  $('#summary').replaceChildren(...rows('Theme', b.theme), ...rows('Typography', b.typography), ...rows('Layout', b.layout));
}

function renderPreviews() {
  const ids = [state.current];
  if ($('#compare').checked) ids.push(Object.keys(state.ds.brands).find((b) => b !== state.current));
  $('#previews').replaceChildren(...ids.map((id) => el('iframe', { src: `/tools/radix-brands/gallery.html?brand=${id}`, title: id })));
}

function select(id, send = true) {
  state.current = id;
  document.querySelectorAll('#brandList button').forEach((b) => b.classList.toggle('active', b.dataset.id === id));
  renderSummary(); renderPreviews();
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
  const blocks = ['hero', 'cards', 'teaser', 'button'];
  const used = {};
  await Promise.all(blocks.map(async (b) => {
    const css = await (await fetch(`/blocks/${b}/${b}.css`)).text();
    const fields = [...new Set([...css.matchAll(/var\((--[\w-]+)/g)].map((m) => fieldOf(m[1])).filter(Boolean))];
    used[b] = { fields, hardcoded: (css.replace(/var\([^)]*\)/g, '').match(/#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(/gi) || []).length };
  }));
  const ids = Object.keys(brands);
  const table = el('table', {}, el('tr', {}, el('th', { textContent: 'Block' }), ...ids.map((i) => el('th', { textContent: brands[i].name }))));
  blocks.forEach((b) => {
    const tr = el('tr', {}, el('th', {}, b, el('small', { textContent: `needs: ${used[b].fields.join(', ')}` })));
    ids.forEach((i) => {
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

async function init() {
  try { state.ds = await loadDesignSystem(); } catch (e) {
    $('#source').textContent = `Could not load the design system (${e.message}). Check the URL in scripts/radix-theme.js.`; return;
  }
  $('#source').textContent = `Design system: ${state.ds.base}`;
  $('#edit').href = state.ds.base;
  Object.values(state.ds.brands).forEach((b) => {
    const btn = el('button', { textContent: b.name }); btn.dataset.id = b.id;
    btn.addEventListener('click', () => select(b.id));
    $('#brandList').append(btn);
  });
  $('#compare').addEventListener('change', renderPreviews);
  document.querySelectorAll('nav button').forEach((b) => b.addEventListener('click', () => {
    document.querySelectorAll('nav button').forEach((x) => x.classList.toggle('active', x === b));
    $('#brands').hidden = b.dataset.tab !== 'brands'; $('#parity').hidden = b.dataset.tab !== 'parity';
    if (b.dataset.tab === 'parity') renderParity();
  }));
  select(Object.keys(state.ds.brands)[0], false);
}
init();

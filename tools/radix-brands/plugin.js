import DA_SDK from 'https://da.live/nx/utils/sdk.js';
import { ACCENTS, GRAYS, RADII } from '/scripts/radix-theme.js';

const $ = (s) => document.querySelector(s);
const el = (t, props = {}, ...kids) => { const n = Object.assign(document.createElement(t), props); n.append(...kids); return n; };

const FIELDS = [
  { key: 'accentColor', label: 'Accent', options: ACCENTS },
  { key: 'grayColor', label: 'Gray', options: GRAYS },
  { key: 'radius', label: 'Radius', options: RADII },
  { key: 'appearance', label: 'Appearance', options: ['light', 'dark'] },
  { key: 'scaling', label: 'Scaling (e.g. 100%)' },
  { key: 'headingTransform', label: 'Heading case', options: ['none', 'uppercase', 'capitalize'] },
  { key: 'headingFont', label: 'Heading font', wide: true },
  { key: 'bodyFont', label: 'Body font', wide: true },
  { key: 'headingTracking', label: 'Heading letter-spacing' },
];

/** All frames below the top window. Cross-origin frames can still be enumerated and messaged. */
function allFrames(win, out = []) {
  try {
    for (let i = 0; i < win.length; i += 1) { out.push(win[i]); allFrames(win[i], out); }
  } catch (e) { /* inaccessible */ }
  return out;
}
/** Send a message to every other frame in the editor, including the page preview. */
function broadcast(message) {
  let top = window;
  try { top = window.top; } catch (e) { /* use self */ }
  allFrames(top).filter((f) => f !== window).forEach((f) => { try { f.postMessage(message, '*'); } catch (e) { /* ignore */ } });
}

function parse(html) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  doc.querySelectorAll('script, style').forEach((n) => n.remove());
  return doc;
}
const isBrandRow = (r) => r.children[0]?.textContent.trim().toLowerCase() === 'brand';
const readBrand = (doc) => [...doc.querySelectorAll('.metadata > div')].find(isBrandRow)?.children[1]?.textContent.trim().toLowerCase() || null;
function withBrand(html, brand) {
  const doc = parse(html);
  let meta = doc.querySelector('.metadata');
  if (!meta) {
    meta = doc.createElement('div'); meta.className = 'metadata';
    const main = doc.querySelector('main') || doc.body;
    (main.querySelector(':scope > div:last-of-type') || main).append(meta);
  }
  let row = [...meta.children].find(isBrandRow);
  if (!row) { row = doc.createElement('div'); row.innerHTML = '<div>brand</div><div></div>'; meta.append(row); }
  row.children[1].textContent = brand;
  return /<html|<body/i.test(html) ? `<body>${doc.body.innerHTML}</body>` : doc.body.innerHTML;
}

(async function init() {
  const sdk = await Promise.race([DA_SDK, new Promise((r) => { setTimeout(() => r(null), 1500); })]);
  const context = sdk?.context || {};
  const actions = sdk?.actions || {};
  const cfg = await (await fetch('/tokens/brands.json')).json();
  const data = {};
  await Promise.all(cfg.brands.map(async (b) => { data[b] = await (await fetch(`/tokens/${b}.json`)).json(); }));
  const saved = {}; cfg.brands.forEach((b) => { saved[b] = JSON.stringify(data[b].theme); });

  let brand = cfg.brands[0]; let liveHtml = ''; let pageBrand = null; let touched = false;
  const dirty = () => JSON.stringify(data[brand].theme) !== saved[brand];
  const status = (t) => { $('#status').textContent = t; };
  const refresh = () => {
    $('#apply').disabled = !dirty();
    $('#setbrand').disabled = !liveHtml || typeof actions.sendHTML !== 'function' || pageBrand === brand;
  };
  const push = () => { broadcast({ type: 'radix-brands:theme', theme: data[brand].theme }); refresh(); };

  function renderControls() {
    const { theme } = data[brand];
    $('#controls').replaceChildren(...FIELDS.map((f) => {
      const input = f.options
        ? el('select', {}, el('option', { value: '', textContent: '(not set)' }), ...f.options.map((o) => el('option', { value: o, textContent: o })))
        : el('input', { type: 'text' });
      input.value = theme[f.key] ?? '';
      input.addEventListener('input', () => {
        if (input.value === '') delete theme[f.key]; else theme[f.key] = input.value;
        push();
        status('Previewing live in the editor. Apply to save it to the repo.');
      });
      return el('label', { className: f.wide ? 'wide' : '' }, f.label, input);
    }));
  }
  function select(b, send = true) {
    brand = b;
    document.querySelectorAll('#brands button').forEach((x) => x.classList.toggle('active', x.dataset.brand === b));
    renderControls();
    if (send) push(); else refresh();
  }

  cfg.brands.forEach((b) => {
    const btn = el('button', { textContent: data[b].name }); btn.dataset.brand = b;
    btn.addEventListener('click', () => { touched = true; select(b); status(`Showing ${data[b].name} in the editor view.`); });
    $('#brands').append(btn);
  });

  const repo = context.org && context.repo ? `${context.org}/${context.repo}` : '';
  try { $('#repo').value = localStorage.getItem('radix-brands-repo') || repo; } catch (e) { $('#repo').value = repo; }
  try { $('#pat').value = sessionStorage.getItem('radix-brands-pat') || ''; } catch (e) { /* ignore */ }
  select(brand, false);
  status(sdk ? 'Pick a brand or change a setting: the editor view updates live.' : 'Preview mode (outside Experience Workspace): nothing to update.');

  if (typeof actions.subscribeLiveDocument === 'function') {
    actions.subscribeLiveDocument(({ html }) => {
      liveHtml = html;
      pageBrand = readBrand(parse(html));
      if (!touched && pageBrand && data[pageBrand] && pageBrand !== brand) select(pageBrand, false);
      refresh();
    });
  }

  // sendHTML(..., { replace: true }) replaces the block currently selected in the editor.
  // So: if the metadata block is selected, rewrite it; if the page has none, insert one at the cursor.
  const metaBlock = (doc, brandName) => {
    let meta = doc.querySelector('.metadata');
    if (!meta) { meta = doc.createElement('div'); meta.className = 'metadata'; }
    let row = [...meta.children].find(isBrandRow);
    if (!row) { row = doc.createElement('div'); row.innerHTML = '<div>brand</div><div></div>'; meta.append(row); }
    row.children[1].textContent = brandName;
    return meta;
  };
  $('#setbrand').addEventListener('click', async () => {
    try {
      const hasMeta = !!parse(liveHtml).querySelector('.metadata');
      if (!hasMeta) {
        actions.sendHTML(metaBlock(parse(''), brand).outerHTML);
        status(`Inserted a metadata block with brand "${brand}" at your cursor. Move it to the bottom of the page if needed.`);
        return;
      }
      let selected = '';
      try { selected = await actions.getSelection(); } catch (e) { selected = ''; }
      const selDoc = parse(selected || '');
      if (!selDoc.querySelector('.metadata')) {
        status('Click the metadata block at the bottom of the page to select it, then press this button again.');
        return;
      }
      const out = await actions.sendHTML(metaBlock(selDoc, brand).outerHTML, { replace: true });
      status(out?.ok === false ? `Could not update the block (${out.error}). Edit the row "brand | ${brand}" by hand.` : `Page brand set to "${brand}".`);
    } catch (e) { status(`Could not update the page (${e.message || e}). Add a metadata row "brand | ${brand}" by hand.`); }
  });

  // Persist the theme: commit tokens/<brand>.json, which every block's CSS variables read.
  $('#apply').addEventListener('click', async () => {
    const [owner, name] = $('#repo').value.split('/');
    const token = $('#pat').value;
    if (!owner || !name || !token) { status('Open "GitHub access" and enter the repo and a token.'); return; }
    try { localStorage.setItem('radix-brands-repo', $('#repo').value); sessionStorage.setItem('radix-brands-pat', token); } catch (e) { /* ignore */ }
    const api = `https://api.github.com/repos/${owner}/${name}`;
    const h = { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' };
    const path = `tokens/${brand}.json`;
    $('#apply').disabled = true; status('Saving to GitHub…');
    try {
      const info = await fetch(api, { headers: h });
      if (!info.ok) throw new Error(`repo ${info.status}`);
      const branch = (await info.json()).default_branch;
      const cur = await fetch(`${api}/contents/${path}?ref=${branch}`, { headers: h });
      const sha = cur.ok ? (await cur.json()).sha : undefined;
      const content = btoa(unescape(encodeURIComponent(`${JSON.stringify(data[brand], null, 2)}\n`)));
      const put = await fetch(`${api}/contents/${path}`, { method: 'PUT', headers: h, body: JSON.stringify({ message: `Update ${data[brand].name} Radix theme`, branch, sha, content }) });
      if (!put.ok) throw new Error(`commit ${put.status}`);
      saved[brand] = JSON.stringify(data[brand].theme);
      status(`Saved ${path} to ${branch}. The site picks it up after Code Sync (a few seconds).`);
    } catch (e) { status(`Save failed: ${e.message}`); }
    refresh();
  });
}());

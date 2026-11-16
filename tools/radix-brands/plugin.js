import DA_SDK from 'https://da.live/nx/utils/sdk.js';
import { applyTheme } from '/scripts/radix-theme.js';

const ORIGIN = new URL(import.meta.url).origin;
const BLOCKS = ['hero', 'cards', 'teaser', 'button'];
const SAMPLE = '<body><main><div><div class="hero"><div><div><h1>Sample page</h1><p>Open this panel inside Experience Workspace to see your own document.</p><p><a href="#">Primary action</a></p></div></div></div><div class="cards"><div><div><h3>One</h3><p>Same blocks.</p></div></div><div><div><h3>Two</h3><p>Every brand.</p></div></div></div></div></main></body>';

const $ = (s) => document.querySelector(s);

/** Documents are plain EDS markup. Use only <main>, drop scripts and the metadata block. */
function parse(html) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  doc.querySelectorAll('script, style').forEach((n) => n.remove());
  return doc;
}
function readBrand(doc) {
  const row = [...doc.querySelectorAll('.metadata > div')].find((r) => r.children[0]?.textContent.trim().toLowerCase() === 'brand');
  return row?.children[1]?.textContent.trim().toLowerCase() || null;
}
function withBrand(html, brand) {
  const doc = parse(html);
  let meta = doc.querySelector('.metadata');
  if (!meta) {
    meta = doc.createElement('div'); meta.className = 'metadata';
    const main = doc.querySelector('main') || doc.body;
    (main.querySelector(':scope > div:last-of-type') || main).append(meta);
  }
  let row = [...meta.children].find((r) => r.children[0]?.textContent.trim().toLowerCase() === 'brand');
  if (!row) {
    row = doc.createElement('div');
    row.innerHTML = '<div>brand</div><div></div>';
    meta.append(row);
  }
  row.children[1].textContent = brand;
  return /<html|<body/i.test(html) ? `<body>${doc.body.innerHTML}</body>` : doc.body.innerHTML;
}

function frameDoc(base) {
  const css = ['/styles/base.css', ...BLOCKS.map((b) => `/blocks/${b}/${b}.css`)].map((h) => `<link rel="stylesheet" href="${ORIGIN}${h}">`).join('');
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><base href="${base}">${css}
<style>main > div { padding: 0; } main > div > :is(p,h1,h2,h3,h4,ul,ol) { max-width: 760px; margin: 16px auto; padding: 0 24px; } a { color: var(--accent-11); } img { max-width: 100%; height: auto; } .metadata, .section-metadata { display: none; }</style></head>
<body><main></main>
<script type="module">
import { applyTheme } from '${ORIGIN}/scripts/radix-theme.js';
addEventListener('message', (e) => {
  if (e.data?.type === 'theme') applyTheme(e.data.theme);
  if (e.data?.type === 'content') document.querySelector('main').innerHTML = e.data.html;
});
parent.postMessage({ type: 'frame-ready' }, '*');
<\/script></body></html>`;
}

(async function init() {
  const sdk = await Promise.race([DA_SDK, new Promise((r) => { setTimeout(() => r(null), 1500); })]);
  const mock = !sdk;
  const context = sdk?.context || { org: 'org', repo: 'site', path: '/index' };
  const actions = sdk?.actions || {};
  const cfg = await (await fetch('/tokens/brands.json')).json();
  const themes = {};
  await Promise.all(cfg.brands.map(async (b) => { themes[b] = await (await fetch(`/tokens/${b}.json`)).json(); }));

  const frame = $('#frame');
  let ready = false; let brand = cfg.brands[0]; let liveHtml = SAMPLE; let pageBrand = null;
  const post = (msg) => frame.contentWindow.postMessage(msg, '*');
  const paint = () => {
    if (!ready) return;
    const doc = parse(liveHtml);
    pageBrand = readBrand(doc);
    post({ type: 'content', html: (doc.querySelector('main') || doc.body).innerHTML });
    post({ type: 'theme', theme: themes[brand].theme });
    $('#apply').disabled = mock || typeof actions.sendHTML !== 'function' || pageBrand === brand;
    $('#status').textContent = mock
      ? 'Preview mode: showing sample content. Open inside Experience Workspace to see your document.'
      : `Showing your current document in ${themes[brand].name}${pageBrand ? ` · page brand is "${pageBrand}"` : ' · no page brand set'}`;
  };
  const select = (b) => {
    brand = b;
    document.querySelectorAll('#brands button').forEach((x) => x.classList.toggle('active', x.dataset.brand === b));
    paint();
  };

  cfg.brands.forEach((b) => {
    const btn = Object.assign(document.createElement('button'), { textContent: themes[b].name });
    btn.dataset.brand = b; btn.addEventListener('click', () => select(b));
    $('#brands').append(btn);
  });

  const page = (context.path || '/index').replace(/^\/[^/]+\/[^/]+(?=\/)/, (m) => (m === `/${context.org}/${context.repo}` ? '' : m)).replace(/\.html$/, '');
  const base = `https://main--${context.repo}--${context.org}.aem.page${page.replace(/[^/]*$/, '')}`;
  window.addEventListener('message', (e) => { if (e.source === frame.contentWindow && e.data?.type === 'frame-ready') { ready = true; select(brand); } });
  frame.srcdoc = frameDoc(base);

  // Live document from Experience Workspace (includes unsaved edits).
  if (typeof actions.subscribeLiveDocument === 'function') {
    actions.subscribeLiveDocument(({ html }) => {
      liveHtml = html;
      const fromDoc = readBrand(parse(html));
      if (fromDoc && themes[fromDoc] && fromDoc !== brand && !$('#brands').dataset.touched) brand = fromDoc;
      select(brand);
    });
  }
  $('#brands').addEventListener('click', () => { $('#brands').dataset.touched = '1'; });

  // Write the choice into the page's metadata so the site's own preview picks it up.
  $('#apply').addEventListener('click', async () => {
    const out = await actions.sendHTML(withBrand(liveHtml, brand), { replace: true });
    $('#status').textContent = out?.ok === false
      ? `Could not update the page (${out.error}). Add a metadata row "brand | ${brand}" by hand.`
      : `Page brand set to "${brand}". The editor preview updates if the site reads the brand metadata.`;
  });
}());

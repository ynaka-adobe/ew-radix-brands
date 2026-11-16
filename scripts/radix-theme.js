/**
 * Consumes the Radix design system (https://github.com/ynaka-adobe/radix-design-system).
 * Brands are published as JSON. Applying one sets the Radix Themes attributes on <main>
 * and loads Radix's own token CSS (@radix-ui/themes/tokens.css), so --accent-9, --space-3,
 * --radius-3, --font-size-4 and the other Radix variables are available to every block.
 */
export const DEFAULT_DS = 'https://ynaka-adobe.github.io/radix-design-system/';
const TOKENS_PREFIX = 'https://cdn.jsdelivr.net/npm/@radix-ui/themes@';
const ACCENTS = ['gold', 'bronze', 'brown', 'red', 'crimson', 'ruby', 'tomato', 'orange', 'amber', 'yellow', 'lime', 'grass', 'green', 'jade', 'mint', 'teal', 'cyan', 'sky', 'blue', 'indigo', 'iris', 'violet', 'purple', 'plum', 'pink'];
const GRAYS = ['gray', 'mauve', 'slate', 'sage', 'olive', 'sand'];
const RADII = ['none', 'small', 'medium', 'large', 'full'];
const CONTAINERS = { 1: '448px', 2: '688px', 3: '880px', 4: '1136px' };
const RAW_PREFIX = 'https://raw.githubusercontent.com/ynaka-adobe/radix-design-system/';
const SAFE_VALUE = /^(?!.*(url\(|@import|expression\(|[;{}<>])).*$/i;

/** Where the design system is published. ?ds= overrides it for the session (testing). */
export function dsBase() {
  let v = new URLSearchParams(window.location.search).get('ds');
  try {
    if (v === 'live') { sessionStorage.removeItem('radix-ds'); v = null; } else if (v) sessionStorage.setItem('radix-ds', v);
    if (!new URLSearchParams(window.location.search).get('ds')) v = sessionStorage.getItem('radix-ds');
  } catch (e) { /* storage unavailable */ }
  try {
    const u = new URL(v || DEFAULT_DS);
    const local = ['localhost', '127.0.0.1'].includes(u.hostname);
    if (u.protocol === 'https:' || (u.protocol === 'http:' && local)) return u.href.endsWith('/') ? u.href : `${u.href}/`;
  } catch (e) { /* fall through */ }
  return DEFAULT_DS;
}

export async function loadManifest(base) {
  // no-cache: always revalidate, so design system updates show up immediately (304 when unchanged)
  const r = await fetch(`${base}manifest.json`, { cache: 'no-cache' });
  if (!r.ok) throw new Error(`manifest ${r.status}`);
  return r.json();
}

export async function loadBrand(base, manifest, id) {
  const entry = manifest.brands.find((b) => b.id === id) || manifest.brands[0];
  const r = await fetch(new URL(entry.file, `${base}manifest.json`), { cache: 'no-cache' });
  if (!r.ok) throw new Error(`brand ${r.status}`);
  const brand = await r.json();
  const defaults = Object.fromEntries(Object.entries(manifest.tokens || {}).map(([k, v]) => [k, v.default]));
  return { id: entry.id, ...brand, tokens: { ...defaults, ...(brand.tokens || {}) } };
}

const text = (v, max = 200) => (typeof v === 'string' && v.length < max && SAFE_VALUE.test(v) ? v : undefined);

/** Keep only known-good values. Also used for messages posted by other frames. */
export function sanitizeBrand(b = {}) {
  const t = b.theme || {}; const ty = b.typography || {}; const l = b.layout || {};
  const theme = {};
  if (ACCENTS.includes(t.accentColor)) theme.accentColor = t.accentColor;
  if (GRAYS.includes(t.grayColor)) theme.grayColor = t.grayColor;
  if (RADII.includes(t.radius)) theme.radius = t.radius;
  if (/^\d{2,3}%$/.test(t.scaling || '')) theme.scaling = t.scaling;
  if (['light', 'dark'].includes(t.appearance)) theme.appearance = t.appearance;
  const typography = {};
  ['headingFont', 'bodyFont', 'headingWeight', 'headingTracking'].forEach((k) => { typography[k] = text(ty[k]); });
  typography.headingTransform = ['none', 'uppercase', 'capitalize'].includes(ty.headingTransform) ? ty.headingTransform : undefined;
  const layout = {};
  if (/^[1-9]$/.test(l.sectionSpace)) layout.sectionSpace = l.sectionSpace;
  if (CONTAINERS[l.containerSize]) layout.containerSize = l.containerSize;
  const tokens = {};
  Object.entries(b.tokens || {}).forEach(([k, v]) => { if (/^--ds-[a-z0-9-]+$/.test(k) && text(v, 100)) tokens[k] = v; });
  return { theme, typography, layout, tokens };
}

function ensureTokens(url) {
  const href = typeof url === 'string' && url.startsWith(TOKENS_PREFIX) && /^[\w@./:-]+$/.test(url)
    ? url : `${TOKENS_PREFIX}3.3.0/tokens.css`;
  let link = document.querySelector('link[data-radix-tokens]');
  if (!link) {
    link = document.createElement('link');
    link.rel = 'stylesheet'; link.dataset.radixTokens = '';
    document.head.append(link);
  }
  if (link.getAttribute('href') !== href) link.setAttribute('href', href);
}

export const pageRoot = () => document.querySelector('main') || document.body;

export function applyBrand(raw, tokensCss, root = pageRoot()) {
  const {
    theme, typography: ty, layout, tokens,
  } = sanitizeBrand(raw);
  ensureTokens(tokensCss);
  root.classList.add('radix-themes');
  root.classList.remove('light', 'dark');
  root.classList.add(theme.appearance || 'light');
  root.dataset.hasBackground = 'true';
  const attr = (k, v) => (v ? root.setAttribute(k, v) : root.removeAttribute(k));
  attr('data-accent-color', theme.accentColor);
  attr('data-gray-color', theme.grayColor);
  attr('data-radius', theme.radius);
  attr('data-scaling', theme.scaling);
  const set = (k, v) => (v ? root.style.setProperty(k, v) : root.style.removeProperty(k));
  set('--default-font-family', ty.bodyFont);
  set('--ds-heading-font', ty.headingFont);
  set('--ds-heading-weight', ty.headingWeight);
  set('--ds-heading-tracking', ty.headingTracking);
  set('--ds-heading-transform', ty.headingTransform);
  set('--ds-section-space', layout.sectionSpace ? `var(--space-${layout.sectionSpace})` : undefined);
  set('--ds-container', layout.containerSize ? CONTAINERS[layout.containerSize] : undefined);
  (root.dataset.dsTokens || '').split(' ').filter(Boolean).forEach((k) => root.style.removeProperty(k));
  Object.entries(tokens).forEach(([k, v]) => root.style.setProperty(k, v));
  root.dataset.dsTokens = Object.keys(tokens).join(' ');
}

/** The design system branch being previewed, or '' for the live design system. */
export function dsBranch(base = dsBase()) {
  if (!base.startsWith(RAW_PREFIX)) return base.startsWith(DEFAULT_DS) ? '' : 'local';
  return base.slice(RAW_PREFIX.length).replace(/\/public\/$/, '');
}

/**
 * Previewing a branch of the design system: also use that branch's block CSS, so authors see
 * block changes before they are merged. Only the design system's own branches and localhost are trusted for this.
 */
export async function applyBranchBlocks(base, manifest) {
  const local = ['localhost', '127.0.0.1'].includes(new URL(base).hostname);
  if (!base.startsWith(RAW_PREFIX) && !local) return;
  const root = base.startsWith(RAW_PREFIX) ? new URL('../eds/blocks/', base) : new URL('eds/blocks/', base);
  await Promise.all(Object.keys(manifest.blocks || {}).filter((n) => /^[a-z][a-z0-9-]*$/.test(n)).map(async (n) => {
    try {
      const r = await fetch(new URL(`${n}/${n}.css`, root), { cache: 'no-cache' });
      if (!r.ok) return;
      document.querySelector(`style[data-ds-block="${n}"]`)?.remove();
      const st = document.createElement('style');
      st.dataset.dsBlock = n; st.textContent = await r.text();
      document.head.append(st);
    } catch (e) { /* block stays as synced */ }
  }));
}

/** Which brand-file field supplies each CSS variable a block may use (drives the parity check). */
export function fieldOf(v) {
  if (/^--accent-/.test(v)) return 'theme.accentColor';
  if (/^--gray-/.test(v)) return 'theme.grayColor';
  if (/^--radius-/.test(v)) return 'theme.radius';
  if (/^--(space|font-size|line-height)-/.test(v)) return 'theme.scaling';
  if (/^--shadow-/.test(v)) return 'theme.appearance';
  const known = {
    '--default-font-family': 'typography.bodyFont',
    '--ds-heading-font': 'typography.headingFont',
    '--ds-heading-weight': 'typography.headingWeight',
    '--ds-heading-tracking': 'typography.headingTracking',
    '--ds-heading-transform': 'typography.headingTransform',
    '--ds-section-space': 'layout.sectionSpace',
    '--ds-container': 'layout.containerSize',
  }[v];
  return known || (/^--ds-/.test(v) ? `tokens.${v}` : undefined);
}

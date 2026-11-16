/**
 * Applies the active brand's Radix theme to the page.
 * Brand comes from ?brand=, then the page's `brand` metadata, then sessionStorage, then the first brand.
 * Add `import './brand.js';` at the top of your site's scripts.js.
 */
import { applyTheme } from './radix-theme.js';

async function applyBrand() {
  const params = new URLSearchParams(window.location.search);
  let brand = params.get('brand') || document.querySelector('meta[name="brand"]')?.content;
  try {
    if (params.get('brand')) sessionStorage.setItem('radix-brand', brand);
    else if (!brand) brand = sessionStorage.getItem('radix-brand');
  } catch (e) { /* storage unavailable */ }
  if (!brand) brand = (await (await fetch('/tokens/brands.json')).json()).brands[0];
  const resp = await fetch(`/tokens/${encodeURIComponent(brand)}.json`);
  if (resp.ok) applyTheme((await resp.json()).theme);
  document.documentElement.dataset.brand = brand;
  return brand;
}

// Live editing: the Radix Brand Themes panel posts theme changes here (from the editor).
// applyTheme() sanitizes them. We reply so the panel can tell the author it worked.
window.addEventListener('message', (e) => {
  if (e.data?.type !== 'radix-brands:theme') return;
  applyTheme(e.data.theme);
  try { e.source?.postMessage({ type: 'radix-brands:applied', href: window.location.href }, '*'); } catch (err) { /* ignore */ }
});

/** Resolves once the brand theme is applied. */
const brandReady = applyBrand();
export default brandReady;

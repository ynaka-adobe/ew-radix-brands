/**
 * Applies the active brand's Radix theme to the page.
 * Brand comes from ?brand=, then the page's `brand` metadata, then sessionStorage, then the first brand.
 * Add `import './brand.js';` at the top of your site's scripts.js.
 */
import { applyTheme } from './radix-theme.js';

export default async function applyBrand() {
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

applyBrand();

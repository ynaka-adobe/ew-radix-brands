/**
 * BrandLens runtime. Applies a brand's design tokens as CSS custom properties.
 * Brand comes from ?brand=, then sessionStorage, then <meta name="brand">, then "toyota".
 * Add `import './brand.js';` at the top of your site's scripts.js.
 */
export async function applyBrand(root = document.documentElement) {
  const params = new URLSearchParams(window.location.search);
  let brand = params.get('brand');
  try {
    if (brand) sessionStorage.setItem('brandlens-brand', brand);
    else brand = sessionStorage.getItem('brandlens-brand');
  } catch (e) { /* storage unavailable */ }
  brand = brand || document.querySelector('meta[name="brand"]')?.content || 'toyota';
  const resp = await fetch(`/tokens/${encodeURIComponent(brand)}.json`);
  if (!resp.ok) return brand;
  const { tokens } = await resp.json();
  Object.entries(tokens).forEach(([k, v]) => root.style.setProperty(k, v));
  root.dataset.brand = brand;
  return brand;
}

applyBrand();

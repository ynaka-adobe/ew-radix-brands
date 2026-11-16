/**
 * Applies the active brand from the published Radix design system.
 * Brand: ?brand=, then the page's `brand` metadata, then sessionStorage, then the first brand.
 * Design system URL: DEFAULT_DS in radix-theme.js (or ?ds= for testing).
 * Add `import './brand.js';` to your site's scripts.js.
 */
import {
  dsBase, loadManifest, loadBrand, applyBrand, applyBranchBlocks, dsBranch,
} from './radix-theme.js';

/** Authors previewing a design system branch get a visible label and a way back to live. */
function showSourceBadge(branch) {
  if (!branch || document.getElementById('ds-source-badge')) return;
  const a = document.createElement('a');
  a.id = 'ds-source-badge';
  a.href = '?ds=live';
  a.textContent = `Previewing design system: ${branch} (switch to live)`;
  a.style.cssText = 'position:fixed;left:12px;bottom:12px;z-index:99;padding:6px 10px;border-radius:999px;background:#1c2024;color:#fff;font:12px system-ui;text-decoration:none';
  document.body.append(a);
}

async function run() {
  try {
    const base = dsBase();
    const manifest = await loadManifest(base);
    const params = new URLSearchParams(window.location.search);
    let id = params.get('brand') || document.querySelector('meta[name="brand"]')?.content;
    try {
      if (params.get('brand')) sessionStorage.setItem('radix-brand', id);
      else if (!id) id = sessionStorage.getItem('radix-brand');
    } catch (e) { /* storage unavailable */ }
    const brand = await loadBrand(base, manifest, id);
    applyBrand(brand, manifest.tokensCss);
    await applyBranchBlocks(base, manifest);
    showSourceBadge(dsBranch(base));
    document.documentElement.dataset.brand = brand.id;
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('Radix design system not applied:', e.message);
  }
}

// Live preview: the Radix Brand Themes app in Experience Workspace posts a brand here.
window.addEventListener('message', (e) => {
  if (e.data?.type !== 'radix-brands:apply') return;
  applyBrand(e.data.brand, e.data.tokensCss);
  try { e.source?.postMessage({ type: 'radix-brands:applied' }, '*'); } catch (err) { /* ignore */ }
});

/** Resolves once the brand is applied (or failed). */
const brandReady = run();
export default brandReady;

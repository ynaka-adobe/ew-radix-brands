import { dsBase, loadManifest, loadBrand } from '/scripts/radix-theme.js';

/** Load the published design system: manifest plus every brand. */
export async function loadDesignSystem() {
  const base = dsBase();
  const manifest = await loadManifest(base);
  const brands = {};
  await Promise.all(manifest.brands.map(async (b) => { brands[b.id] = await loadBrand(base, manifest, b.id); }));
  return { base, manifest, brands };
}

function allFrames(win, out = []) {
  try { for (let i = 0; i < win.length; i += 1) { out.push(win[i]); allFrames(win[i], out); } } catch (e) { /* inaccessible */ }
  return out;
}

let acks = 0; let timer;
window.addEventListener('message', (e) => { if (e.data?.type === 'radix-brands:applied') acks += 1; });

/**
 * Show a brand in the editor view. Experience Workspace has no SDK call for this, so post to every
 * frame and to the top window. The site's brand.js applies it and replies.
 */
export function showInEditor(brand, tokensCss, onResult, skip = []) {
  let top = window;
  try { top = window.top; } catch (e) { /* use self */ }
  const targets = [...allFrames(top).filter((f) => f !== window && !skip.includes(f)), ...(top !== window ? [top] : [])];
  acks = 0;
  targets.forEach((f) => { try { f.postMessage({ type: 'radix-brands:apply', brand, tokensCss }, '*'); } catch (e) { /* ignore */ } });
  clearTimeout(timer);
  timer = setTimeout(() => onResult?.({ reached: targets.length, acks }), 700);
}
export const ownFrames = () => allFrames(window);

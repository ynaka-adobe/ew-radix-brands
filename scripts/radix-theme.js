/**
 * Applies a Radix Themes style configuration to a plain-HTML page.
 * Colors come from Radix Colors (https://www.radix-ui.com/colors), the same 12-step scales
 * Radix Themes uses. Config keys mirror the <Theme> props: accentColor, grayColor, radius,
 * scaling, appearance. Extra brand keys: headingFont, bodyFont, headingTracking, headingTransform.
 */
export const COLORS_CDN = 'https://cdn.jsdelivr.net/npm/@radix-ui/colors@3.0.0';
export const ACCENTS = ['gold', 'bronze', 'brown', 'red', 'crimson', 'ruby', 'tomato', 'orange', 'amber', 'yellow', 'lime', 'grass', 'green', 'jade', 'mint', 'teal', 'cyan', 'sky', 'blue', 'indigo', 'iris', 'violet', 'purple', 'plum', 'pink'];
export const GRAYS = ['gray', 'mauve', 'slate', 'sage', 'olive', 'sand'];
export const RADII = ['none', 'small', 'medium', 'large', 'full'];
const DARK_TEXT_ON_ACCENT = ['amber', 'yellow', 'lime', 'mint', 'sky'];
const RADIUS = { none: [0, 0], small: [6, 6], medium: [8, 8], large: [12, 12], full: [16, 999] };

/** Which config key supplies each CSS variable a block may use (drives the parity check). */
export function sourceOf(variable) {
  if (/^--accent-(\d+|contrast)$/.test(variable)) return 'accentColor';
  if (/^--gray-\d+$/.test(variable)) return 'grayColor';
  return {
    '--brand-radius-card': 'radius',
    '--brand-radius-button': 'radius',
    '--brand-space-section': 'scaling',
    '--brand-shadow-card': 'appearance',
    '--brand-font-heading': 'headingFont',
    '--brand-font-body': 'bodyFont',
    '--brand-heading-tracking': 'headingTracking',
    '--brand-heading-transform': 'headingTransform',
  }[variable];
}

function link(href) {
  const l = document.createElement('link');
  l.rel = 'stylesheet'; l.href = href; l.dataset.radix = '';
  document.head.append(l);
}

export function applyTheme(config, doc = document) {
  const root = doc.documentElement;
  const { accentColor, grayColor } = config;
  doc.querySelectorAll('link[data-radix]').forEach((l) => l.remove());
  [accentColor, grayColor].filter(Boolean).forEach((c) => { link(`${COLORS_CDN}/${c}.css`); link(`${COLORS_CDN}/${c}-dark.css`); });
  root.classList.remove('light-theme', 'dark-theme');
  root.classList.add(config.appearance === 'dark' ? 'dark-theme' : 'light-theme');
  const set = (k, v) => (v === undefined || v === null ? root.style.removeProperty(k) : root.style.setProperty(k, v));
  for (let i = 1; i <= 12; i += 1) {
    set(`--accent-${i}`, accentColor ? `var(--${accentColor}-${i})` : null);
    // The "gray" scale already defines --gray-N itself; alias only the tinted grays.
    set(`--gray-${i}`, grayColor && grayColor !== 'gray' ? `var(--${grayColor}-${i})` : null);
  }
  set('--accent-contrast', accentColor ? (DARK_TEXT_ON_ACCENT.includes(accentColor) ? '#1c2024' : '#ffffff') : null);
  const r = RADIUS[config.radius];
  set('--brand-radius-card', r ? `${r[0]}px` : null);
  set('--brand-radius-button', r ? `${r[1]}px` : null);
  set('--brand-space-section', config.scaling ? `${Math.round((64 * parseFloat(config.scaling)) / 100)}px` : null);
  set('--brand-shadow-card', config.appearance ? (config.appearance === 'dark' ? 'none' : '0 4px 16px rgba(0,0,0,.12)') : null);
  set('--brand-font-heading', config.headingFont);
  set('--brand-font-body', config.bodyFont);
  set('--brand-heading-tracking', config.headingTracking);
  set('--brand-heading-transform', config.headingTransform);
}

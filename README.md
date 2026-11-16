# Radix Brand Themes for Experience Workspace

Edge Delivery blocks that are styled entirely by a **Radix design system**. The UX team edits brands in the [Radix Design System](https://github.com/ynaka-adobe/radix-design-system) (a standalone Radix Themes app). This extension and the site read the published design system at runtime, so a design system update shows up in Experience Workspace and on the site with no code change and no sync step.

Radix is the third-party integration: brands are Radix Themes settings, and the site loads Radix's own token CSS (`@radix-ui/themes/tokens.css`), so blocks use real Radix variables such as `--accent-9`, `--gray-3`, `--space-4`, `--radius-3`, `--font-size-4`.

| Persona | Where | What they do |
|---|---|---|
| UX / design | Radix Design System app | Edit brands (accent, gray, radius, scaling, appearance, typography, layout), compare, export JSON, publish |
| Author | Radix Brand Themes app (this repo) | Pick a brand and see it in the editor view; the page's `brand` metadata decides the live brand |
| Developer | Parity tab of the same app | Matrix of blocks x brands: missing design system fields and hardcoded colors or sizes |

## How it works
- `scripts/radix-theme.js` loads `manifest.json` and the brand JSON files from the design system, then sets the Radix Themes attributes (`data-accent-color`, `data-gray-color`, `data-radius`, `data-scaling`, light/dark class) on `<main>` and loads Radix's token CSS. Values are validated before use.
- Blocks (`blocks/`) only use Radix variables and a few `--ds-*` variables (typography and layout) set from the brand file.
- `scripts/brand.js` picks the brand: `?brand=`, then the page's `brand` metadata, then the first brand.
- The app (`tools/radix-brands/`) lists the design system's brands, shows each brand's settings, previews the shared blocks, and tries to show the chosen brand in the editor view.

## Deploy
1. Publish the design system (see its README) and set `DEFAULT_DS` in `scripts/radix-theme.js` to its URL. You can also test with `?ds=http://localhost:3016/`.
2. Copy `blocks/`, `styles/base.css`, `scripts/radix-theme.js`, `scripts/brand.js` and `tools/radix-brands/` into your Edge Delivery repo. In `scripts.js` add `import './brand.js';` and `await` its default export before showing the page (see `scripts/scripts.js` here).
3. Register the app in the site config (https://da.live/config#/ORG/SITE/):
   - `apps` sheet row: title `Radix Brand Themes`, path `https://da.live/app/ORG/SITE/tools/radix-brands/radix-brands`
   - or a `panels`/`library` row with path `https://main--SITE--ORG.aem.live/tools/radix-brands/radix-brands.html`
4. To give a page a brand, add a Metadata block row `brand | <brand id>`.

## Editor view
Experience Workspace has no SDK call to restyle its preview. The app posts the chosen brand to the editor window and the site's `brand.js` applies it and replies. If the status line reports that no page responded, refresh the editor; the page reads the brand from its metadata on load.

## Local development
Run `python3 -m http.server 3000` here and `npm run dev -- --port 3016` in the design system, then open `http://localhost:3000/tools/radix-brands/radix-brands.html?ds=http://localhost:3016/`.

Brands are placeholders inspired by automotive branding, not affiliated assets. Not affiliated with or endorsed by Radix or WorkOS.

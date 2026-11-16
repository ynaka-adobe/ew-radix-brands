# Radix Brand Themes for Experience Workspace

Share one set of blocks across brands, and let each brand look like itself. Brands are defined as [Radix Themes](https://www.radix-ui.com/themes) style configurations (`accentColor`, `grayColor`, `radius`, `scaling`, `appearance`) and rendered with the 12-step [Radix Colors](https://www.radix-ui.com/colors) scales, loaded from the jsDelivr CDN (`@radix-ui/colors`). Radix is the third-party integration. Plain CSS variables are used, so the blocks work in Edge Delivery without React.

| Persona | Where | What they do |
|---|---|---|
| Author | Library plugin (`tools/radix-brands/plugin`) | Sees the document they are editing, live (including unsaved edits), rendered in any brand. "Set as this page's brand" writes a `brand` row into the page metadata |
| Designer | Fullscreen app (`tools/radix-brands/radix-brands`) | Pick Radix accent/gray/radius/scaling/appearance, see every block update live, compare brands side by side, save to GitHub as a pull request |
| Developer | Parity tab of the same app | Matrix of blocks x brands: missing theme settings and hardcoded colors |

## How it works
- `tokens/<brand>.json` holds the Radix theme config for a brand.
- `scripts/radix-theme.js` loads the chosen Radix color scales and maps them to `--accent-1..12`, `--gray-1..12` plus brand variables (`--brand-radius-*`, `--brand-space-section`, fonts).
- Blocks in `blocks/` only use those variables, never raw colors, so any brand renders correctly.
- `scripts/brand.js` applies the brand on real pages. It reads `?brand=<name>`, then the page's `brand` metadata.

## How the panel and the editor preview connect
- The panel subscribes to the live document with the Experience Workspace SDK (`actions.subscribeLiveDocument`) and renders it with the shared blocks and the selected Radix theme.
- Extensions cannot restyle the editor's own preview directly. Instead, "Set as this page's brand" updates the document with `actions.sendHTML(html, { replace: true })`, adding a metadata row `brand | <name>`. A site that includes `brand.js` and the shared blocks re-themes its own preview from that metadata. The site's blocks must use the `--accent-*`, `--gray-*` and `--brand-*` variables, otherwise only this panel changes.

## Deploy
1. Copy `tokens/`, `blocks/`, `styles/base.css`, `scripts/radix-theme.js`, `scripts/brand.js` and `tools/radix-brands/` into your Edge Delivery repo and push to `main`. Merge the blocks with your own, keeping the variable convention.
2. In your site's `scripts.js` add `import './brand.js';` at the top.
3. List your brands and blocks in `tokens/brands.json`.
4. In the site config (https://da.live/config#/ORG/SITE/):
   - `apps` sheet row: title `Radix Brand Themes`, path `https://da.live/app/ORG/SITE/tools/radix-brands/radix-brands`
   - `library` sheet row: title `Radix Brand Themes`, path `https://main--SITE--ORG.aem.live/tools/radix-brands/plugin`
5. Open `https://da.live/app/ORG/SITE/tools/radix-brands/radix-brands`.

## Saving to GitHub
In the designer app open "Save to GitHub", enter `owner/repo` and a fine-grained personal access token with Contents: read/write. The token is only held in the page. Saving writes `tokens/<brand>.json` to branch `radix-brands/<brand>-theme` and links to the pull request.

## Local development
Run `python3 -m http.server 3000` in this folder and open `http://localhost:3000/tools/radix-brands/radix-brands.html`. In Experience Workspace use `?ref=local`.

## Demo script
1. Designer: change the Lexus accent from gold to another Radix color, switch Toyota to dark. Every block follows.
2. Author: open a page, switch brands in the plugin.
3. Developer: Parity tab. `Genesis (incomplete)` ships with missing settings to show failures.

Brands are placeholders inspired by automotive branding, not affiliated assets. Radix is a trademark of its owner; this project is not affiliated with or endorsed by Radix or WorkOS.

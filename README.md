# BrandLens: multi-brand design system for Experience Workspace

One set of blocks, many brands. Brand differences live in design tokens (CSS custom properties) in `tokens/<brand>.json`. Blocks only use `var(--brand-*)`.

| Persona | Where | What they do |
|---|---|---|
| Author | Library plugin (`tools/brandlens/plugin`) | Switch brand and preview the page they are editing |
| Designer | Fullscreen app (`tools/brandlens/brandlens`) | Edit tokens with live block previews, compare brands, save to GitHub as a PR |
| Developer | Parity tab of the same app | Matrix of blocks x brands: missing tokens, hardcoded colors, contrast warnings |

Third-party integration: **GitHub** (designer saves tokens to a branch and opens a PR through the GitHub API).

## Deploy
1. Copy `tokens/`, `blocks/`, `styles/`, `scripts/brand.js` and `tools/brandlens/` into your Edge Delivery repo (blocks can be merged with your own; keep the `--brand-*` convention). Push to `main`.
2. In your site's `scripts.js` add `import './brand.js';` at the top. Pages then honour `?brand=<name>`.
3. Add each brand name to `tokens/brands.json` and your block names to its `blocks` list.
4. Register in the site config (https://da.live/config#/ORG/SITE/):
   - `apps` sheet row: title `BrandLens`, path `https://da.live/app/ORG/SITE/tools/brandlens/brandlens`
   - `library` sheet row: title `BrandLens`, path `https://main--SITE--ORG.aem.live/tools/brandlens/plugin`
5. Open `https://da.live/app/ORG/SITE/tools/brandlens/brandlens`.

## Saving to GitHub
In the designer app open "Save to GitHub", enter `owner/repo` and a fine-grained personal access token with Contents: read/write on that repo. The token stays in the page (never stored). Saving writes `tokens/<brand>.json` to branch `brandlens/<brand>-tokens` and links to the pull request.

## Local development
`python3 -m http.server 3000` in this folder, then open `http://localhost:3000/tools/brandlens/brandlens.html`. Use `?ref=local` in Experience Workspace to load it from localhost.

## Demo script
1. Designer: change Lexus accent, watch every block update; contrast warnings appear if AA fails.
2. Author: open a page, switch Toyota/Lexus in the plugin.
3. Developer: Parity tab. `Genesis (incomplete)` ships with missing tokens to show failures.

Brands in this repo are placeholders inspired by automotive branding, not affiliated assets.

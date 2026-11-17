// Develop tab: create a block from Experience Workspace, preview it on its own git branch, publish it.
import {
  HUB_REPO, SITE_REPO, HUB_URL, getToken, setToken, siteHost, saveBranch, readFile, ensurePullRequest,
  mergePullRequest, deleteBranch, waitForHubDeploy, startSiteSync, waitForSitePullRequest,
} from '/tools/radix-brands/github.js';

const $ = (s) => document.querySelector(s);
const el = (t, props = {}, ...kids) => { const n = Object.assign(document.createElement(t), props); n.append(...kids); return n; };
const DA_ADMIN = 'https://admin.da.live';
const AEM_ADMIN = 'https://admin.hlx.page';
const state = { sdk: null, built: null };

async function loadSdk() {
  if (state.sdk) return state.sdk;
  try {
    const { default: DA_SDK } = await import('https://da.live/nx/utils/sdk.js');
    // Outside Experience Workspace the handshake never answers, so do not wait forever.
    state.sdk = await Promise.race([DA_SDK, new Promise((res) => { setTimeout(() => res({}), 4000); })]);
  } catch (e) { state.sdk = {}; }
  return state.sdk;
}

const titleOf = (n) => n.replace(/(^|-)(\w)/g, (_, a, c) => (a ? ' ' : '') + c.toUpperCase());

/** Starter files for a new block. */
function starter(name, spec) {
  return {
    spec: `${JSON.stringify({ title: spec.title, status: 'draft', description: spec.description, authoring: spec.authoring }, null, 2)}\n`,
    css: `.${name} {\n  padding: var(--ds-section-space, var(--space-8)) var(--space-5);\n  max-width: var(--ds-container, 880px);\n  margin: 0 auto;\n  color: var(--gray-12);\n}\n`,
    js: 'export default function decorate(block) {\n  // Decorate the authored rows in block.children\n}\n',
    jsx: `export default function ${titleOf(name).replace(/\s/g, '')}() {\n  return null;\n}\n`,
    sample: `<div class="${name}"><div><div><p>Sample content</p></div></div></div>\n`,
  };
}

const log = (text, cls = '') => { $('#devSteps').append(el('li', { textContent: text, className: cls })); };
const setBusy = (b) => document.querySelectorAll('#develop button').forEach((x) => { x.disabled = b; });

/** Write a page into DA so it shows in the editor's Content and Layout windows, and preview it. */
async function writePage(name, sample) {
  const { context, actions } = await loadSdk();
  if (!actions?.daFetch) throw new Error('Open this panel inside Experience Workspace to create the content page.');
  const html = `<body><header></header><main><div>${sample}</div></main><footer></footer></body>`;
  const body = new FormData();
  body.append('data', new Blob([html], { type: 'text/html' }));
  const path = `drafts/${name}`;
  const put = await actions.daFetch(`${DA_ADMIN}/source/${context.org}/${context.repo}/${path}.html`, { method: 'POST', body });
  if (!put.ok) throw new Error(`DA ${put.status}`);
  await actions.daFetch(`${AEM_ADMIN}/preview/${context.org}/${context.repo}/main/${path}`, { method: 'POST' }).catch(() => null);
  return { path, daUrl: `https://da.live/canvas#/${context.org}/${context.repo}/${path}` };
}

async function create() {
  const token = $('#devToken').value.trim();
  const name = $('#devName').value.trim().toLowerCase();
  if (!/^[a-z][a-z0-9-]*$/.test(name)) { $('#devStatus').textContent = 'Use lowercase letters, numbers and dashes, starting with a letter.'; return; }
  if (!token) { $('#devStatus').textContent = 'Enter your GitHub token.'; return; }
  setToken(token); $('#devSteps').replaceChildren(); $('#devStatus').textContent = ''; $('#devLinks').replaceChildren();
  setBusy(true);
  try {
    const spec = { title: titleOf(name), description: $('#devDesc').value.trim(), authoring: $('#devAuth').value.trim() };
    const f = starter(name, spec);
    const branch = `block-${name}`;
    const manifest = await (await fetch(`${HUB_URL}manifest.json`, { cache: 'no-store' })).json();
    if (manifest.blocks?.[name]) throw new Error(`The block "${name}" already exists in the design system.`);
    manifest.blocks = { ...(manifest.blocks || {}), [name]: 'collection' };

    log('Registering the block in the design system…');
    const dir = `eds/blocks/${name}`;
    const hub = await saveBranch({
      token, repo: HUB_REPO, branch, message: `Register block: ${name}`,
      files: {
        'public/manifest.json': `${JSON.stringify(manifest, null, 2)}\n`,
        [`${dir}/spec.json`]: f.spec, [`${dir}/${name}.css`]: f.css, [`${dir}/${name}.js`]: f.js, [`${dir}/index.jsx`]: f.jsx, [`${dir}/sample.html`]: f.sample,
      },
    });
    log(`Created branch ${branch} in the design system.`, 'ok');
    const pr = await ensurePullRequest({ token, branch, title: `New block: ${name}`, body: spec.description || name });

    log('Putting the block code on a branch of the site…');
    await saveBranch({ token, repo: SITE_REPO, branch, message: `Preview block: ${name}`, files: { [`blocks/${name}/${name}.css`]: f.css, [`blocks/${name}/${name}.js`]: f.js } });
    log(`Created branch ${branch} in the site.`, 'ok');

    log('Creating the content page in Experience Workspace…');
    const page = await writePage(name, f.sample);
    log(`Content page: ${page.path}`, 'ok');

    state.built = { name, branch, pr, daUrl: page.daUrl, sha: hub.sha, path: page.path };
    $('#devLinks').replaceChildren(
      el('p', {}, el('a', { href: page.daUrl, target: '_blank', rel: 'noopener', textContent: 'Open the content in Experience Workspace' }), ' (Content and Layout windows)'),
      el('p', {}, el('a', { href: `${siteHost(branch)}${page.path}`, target: '_blank', rel: 'noopener', textContent: `Preview on the branch: ${branch}` })),
      el('p', {}, el('a', { href: pr.url, target: '_blank', rel: 'noopener', textContent: 'Pull request in the design system' })),
      el('p', { className: 'hint', textContent: `Edit eds/blocks/${name}/ on the branch ${branch}, then Refresh preview.` }),
    );
    $('#devNext').hidden = false;
  } catch (e) { $('#devStatus').textContent = `Could not finish: ${e.message}`; }
  setBusy(false);
}

/** Copy the block code from the design system branch to the site branch, so the branch preview shows the latest. */
async function refresh() {
  const { name, branch } = state.built; const token = getToken();
  setBusy(true); $('#devStatus').textContent = 'Refreshing the branch preview…';
  try {
    const [css, js] = await Promise.all([1, 2].map((i) => readFile(token, HUB_REPO, branch, `eds/blocks/${name}/${name}.${i === 1 ? 'css' : 'js'}`)));
    await saveBranch({ token, repo: SITE_REPO, branch, message: `Refresh preview: ${name}`, files: { [`blocks/${name}/${name}.css`]: css, [`blocks/${name}/${name}.js`]: js } });
    $('#devStatus').textContent = 'Branch preview refreshed. Reload the preview tab in about 20 seconds.';
  } catch (e) { $('#devStatus').textContent = `Could not refresh: ${e.message}`; }
  setBusy(false);
}

/** Merge to main and deliver to the site. */
async function publish() {
  const { name, branch, pr } = state.built; const token = getToken();
  setBusy(true); $('#devStatus').textContent = '';
  const since = Date.now();
  try {
    log('Merging into the design system…');
    await mergePullRequest({ token, number: pr.number, branch });
    log('Merged.', 'ok');
    log('Waiting for the design system to deploy…');
    await waitForHubDeploy(since);
    log('Starting the site sync…');
    await startSiteSync(token);
    const sp = await waitForSitePullRequest(token, since);
    log(`Site pull request #${sp.number} ready.`, 'ok');
    await mergePullRequest({ token, number: sp.number, branch: 'design-system-sync', repo: SITE_REPO });
    await deleteBranch(token, SITE_REPO, branch);
    log('Merged into the site. Branches removed.', 'ok');
    const { context } = await loadSdk();
    $('#devLinks').replaceChildren(
      el('p', {}, el('a', { href: state.built.daUrl, target: '_blank', rel: 'noopener', textContent: 'Open the content in Experience Workspace' }), ' and switch to the Layout window'),
      el('p', {}, el('a', { href: `https://main--${context.repo || 'ew-radix-brands'}--${context.org || 'ynaka-adobe'}.aem.page/${state.built.path}`, target: '_blank', rel: 'noopener', textContent: 'Preview on the main site' })),
    );
    $('#devNext').hidden = true;
  } catch (e) { $('#devStatus').textContent = `Could not finish: ${e.message}`; }
  setBusy(false);
}

export function initDevelop() {
  if (state.ready) return;
  state.ready = true;
  $('#devToken').value = getToken();
  $('#devCreate').addEventListener('click', create);
  $('#devRefresh').addEventListener('click', refresh);
  $('#devPublish').addEventListener('click', publish);
  loadSdk();
}

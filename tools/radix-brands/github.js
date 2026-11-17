// GitHub helpers for the Develop tab. Uses the developer's own token, kept in this tab only.
export const HUB_REPO = 'ynaka-adobe/radix-design-system';
export const SITE_REPO = 'ynaka-adobe/ew-radix-brands';
export const HUB_URL = 'https://ynaka-adobe.github.io/radix-design-system/';
const [OWNER, SITE_NAME] = SITE_REPO.split('/');

export const getToken = () => { try { return sessionStorage.getItem('ds-github-token') || ''; } catch (e) { return ''; } };
export const setToken = (t) => { try { sessionStorage.setItem('ds-github-token', t); } catch (e) { /* storage unavailable */ } };

async function api(token, path, options = {}, repo = HUB_REPO) {
  const r = await fetch(`https://api.github.com/repos/${repo}/${path}`, {
    ...options,
    cache: 'no-store',
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json' },
  });
  const body = r.status === 204 ? {} : await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`${r.status} ${body.message || r.statusText}`);
  return body;
}

/** The address Edge Delivery serves a branch of the site at. */
export const siteHost = (branch) => `https://${branch}--${SITE_NAME}--${OWNER}.aem.page/`;

/** Save files to a branch: add a commit if it exists, otherwise create it from main. */
export async function saveBranch({
  token, repo, branch, message, files, base = 'main',
}) {
  if (!/^[\w.-]+$/.test(branch)) throw new Error('Branch names use letters, numbers, dots and dashes only (no slashes).');
  let parent; let updated = false;
  try { parent = (await api(token, `git/ref/heads/${branch}`, {}, repo)).object.sha; updated = true; } catch (e) {
    if (!String(e.message).startsWith('404')) throw e;
    parent = (await api(token, `git/ref/heads/${base}`, {}, repo)).object.sha;
  }
  const baseCommit = await api(token, `git/commits/${parent}`, {}, repo);
  const tree = await api(token, 'git/trees', {
    method: 'POST',
    body: JSON.stringify({ base_tree: baseCommit.tree.sha, tree: Object.entries(files).map(([path, content]) => ({ path, mode: '100644', type: 'blob', content })) }),
  }, repo);
  const commit = await api(token, 'git/commits', { method: 'POST', body: JSON.stringify({ message, tree: tree.sha, parents: [parent] }) }, repo);
  if (updated) await api(token, `git/refs/heads/${branch}`, { method: 'PATCH', body: JSON.stringify({ sha: commit.sha }) }, repo);
  else await api(token, 'git/refs', { method: 'POST', body: JSON.stringify({ ref: `refs/heads/${branch}`, sha: commit.sha }) }, repo);
  return { sha: commit.sha, updated };
}

/** Text of a file on a branch. */
export async function readFile(token, repo, branch, path) {
  const r = await fetch(`https://api.github.com/repos/${repo}/contents/${path}?ref=${encodeURIComponent(branch)}`, {
    cache: 'no-store', headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github.raw+json' },
  });
  if (!r.ok) throw new Error(`${r.status} reading ${path}`);
  return r.text();
}

export async function ensurePullRequest({ token, branch, title, body }) {
  const open = await api(token, `pulls?head=${OWNER}:${encodeURIComponent(branch)}&state=open`);
  if (open.length) return { number: open[0].number, url: open[0].html_url };
  const pr = await api(token, 'pulls', { method: 'POST', body: JSON.stringify({ title, body, head: branch, base: 'main' }) });
  return { number: pr.number, url: pr.html_url };
}

export async function mergePullRequest({ token, number, branch, repo = HUB_REPO }) {
  await api(token, `pulls/${number}/merge`, { method: 'PUT', body: JSON.stringify({ merge_method: 'squash' }) }, repo);
  try { await api(token, `git/refs/heads/${branch}`, { method: 'DELETE' }, repo); } catch (e) { /* already gone */ }
}

export async function deleteBranch(token, repo, branch) {
  try { await api(token, `git/refs/heads/${branch}`, { method: 'DELETE' }, repo); } catch (e) { /* already gone */ }
}

/** Wait until the published design system is newer than `since`. */
export async function waitForHubDeploy(since, tries = 40) {
  for (let i = 0; i < tries; i += 1) {
    try {
      const r = await fetch(`${HUB_URL}registry.json?t=${Date.now()}`, { cache: 'no-store' });
      if (r.ok && Date.parse((await r.json()).generatedAt) > since) return;
    } catch (e) { /* retry */ }
    await new Promise((res) => { setTimeout(res, 4000); });
  }
  throw new Error('The design system has not finished publishing yet.');
}

export async function startSiteSync(token) {
  await api(token, 'actions/workflows/ds-sync.yml/dispatches', { method: 'POST', body: JSON.stringify({ ref: 'main' }) }, SITE_REPO);
}

export async function waitForSitePullRequest(token, since, tries = 40) {
  for (let i = 0; i < tries; i += 1) {
    const prs = await api(token, `pulls?head=${OWNER}:design-system-sync&state=open`, {}, SITE_REPO);
    const pr = prs.find((x) => Date.parse(x.updated_at) > since);
    if (pr) return { number: pr.number, url: pr.html_url };
    await new Promise((res) => { setTimeout(res, 4000); });
  }
  throw new Error('The site pull request has not appeared yet.');
}

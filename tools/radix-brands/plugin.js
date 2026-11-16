import DA_SDK from 'https://da.live/nx/utils/sdk.js';

(async function init() {
  const { context } = await DA_SDK;
  const { org, repo, path } = context;
  const page = (path || '/').replace(/\.html$/, '').replace(/\/index$/, '/');
  const brands = (await (await fetch('/tokens/brands.json')).json()).brands;
  const frame = document.getElementById('frame');
  const open = document.getElementById('open');
  const wrap = document.getElementById('brands');
  const show = (brand) => {
    const url = `https://main--${repo}--${org}.aem.page${page}?brand=${brand}`;
    frame.src = url; open.href = url;
    wrap.querySelectorAll('button').forEach((b) => b.classList.toggle('active', b.dataset.brand === brand));
  };
  brands.forEach((b) => {
    const btn = Object.assign(document.createElement('button'), { textContent: b[0].toUpperCase() + b.slice(1) });
    btn.dataset.brand = b; btn.addEventListener('click', () => show(b)); wrap.append(btn);
  });
  show(brands[0]);
}());

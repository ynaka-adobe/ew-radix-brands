import {
  decorateSections,
  decorateBlocks,
  decorateTemplateAndTheme,
  waitForFirstImage,
  loadSection,
  loadSections,
} from './aem.js';
import brandReady from './brand.js';

async function loadEager(doc) {
  document.documentElement.lang = 'en';
  decorateTemplateAndTheme();
  const main = doc.querySelector('main');
  if (main) {
    decorateSections(main);
    decorateBlocks(main);
    // Apply the page's brand (?brand= or "brand" metadata) before first paint.
    await brandReady;
    document.body.classList.add('appear');
    await loadSection(main.querySelector('.section'), waitForFirstImage);
  }
}

async function loadLazy(doc) {
  await loadSections(doc.querySelector('main'));
}

(async function load() {
  await loadEager(document);
  await loadLazy(document);
}());

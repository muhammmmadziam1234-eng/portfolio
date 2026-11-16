import config from '../../site.config.js';
import {projects, bySlug} from './projects.js';
import {h, $, announce, repoUrl} from './util.js';
import {mountScrubber} from './widgets/scrubber.js';
import {explodeFrames, explodeText} from './media.js';

const widgetFiles = {sensor: 'sensor.js', lamp: 'lamp.js', ads: 'ads.js', pcb: 'pcb.js', embed: 'embed.js', geojson: 'geojson.js', recording: 'recording.js'};
const main = $('#main');
let facts = {};
let sources = [];
let cleanup = () => {};

async function loadData() {
  const get = async name => { try { const r = await fetch(`data/${name}`); return r.ok ? await r.json() : null; } catch { return null; } };
  facts = (await get('facts.json')) ?? {};
  sources = (await get('sources.json')) ?? [];
}

function route() {
  const hash = location.hash.replace(/^#\/?/, '');
  const project = hash.match(/^p\/([a-z0-9-]+)$/);
  if (project && bySlug[project[1]]) return {name: 'project', slug: project[1]};
  if (hash === 'method') return {name: 'method'};
  if (hash === 'all') return {name: 'home', scrollTo: 'all'};
  if (hash === '' || hash === '/') return {name: 'home'};
  return {name: 'missing'};
}

function factLines(slug, count) {
  return (facts[slug] ?? []).filter(f => f.line).slice(0, count);
}

function setChrome(current) {
  $('#site-name').textContent = config.name || 'Portfolio';
  $('#foot-line').textContent = `© 2026 ${config.name || config.githubUser}. All rights reserved. Archivo (this page) and Gelasio (the flood map and the paint estimator) are open typefaces and keep their own licences.`;
  const upwork = $('#upwork');
  if (config.upworkUrl) { upwork.href = config.upworkUrl; upwork.target = '_blank'; upwork.rel = 'noopener'; upwork.hidden = false; }
  for (const link of document.querySelectorAll('.bar nav a:not(.btn)')) {
    const target = link.getAttribute('href');
    const active = (current.name === 'method' && target === '#/method') || (current.name === 'home' && current.scrollTo === 'all' && target === '#/all');
    if (active) link.setAttribute('aria-current', 'page'); else link.removeAttribute('aria-current');
  }
  $('#start-tour').href = `#/p/${projects[0].slug}`;
  $('#foot-sources').textContent = sources.length
    ? `The demos on this page were built from ${sources.map(s => `${s.repo} at ${s.commit.slice(0, 7)}`).join(', ')}.` : '';
}

function registerTable() {
  const rows = projects.map(p => h('tr', {},
    h('th', {scope: 'row'}, h('div', {class: 'who'},
      h('img', {class: 'thumb', src: p.thumb, alt: '', width: 112, height: 84, loading: 'lazy'}),
      h('span', {}, h('strong', {}, h('a', {href: `#/p/${p.slug}`}, p.title)), h('small', {}, p.kind)))),
    h('td', {class: 'try', 'data-label': 'What you can try'}, p.tryShort),
    h('td', {class: 'proof', 'data-label': 'Checked by'}, h('ul', {}, factLines(p.slug, 2).map(f => h('li', {}, f.line)))),
    h('td', {class: 'go'}, h('a', {class: 'btn secondary small', href: `#/p/${p.slug}`, 'aria-label': `Open ${p.title}`}, 'Open'))));
  return h('table', {class: 'register'},
    h('caption', {}, 'The eight projects, in tour order'),
    h('thead', {}, h('tr', {}, h('th', {scope: 'col'}, 'Project'), h('th', {scope: 'col'}, 'What you can try'), h('th', {scope: 'col'}, 'Checked by'), h('th', {scope: 'col'}, h('span', {class: 'sr'}, 'Open')))),
    h('tbody', {}, rows));
}

const countWords = ['No', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
function methodSection(onOwnPage) {
  const sub = onOwnPage ? 'h2' : 'h3';
  const checked = sources.filter(s => s.ci).length;
  const ciText = sources.length
    ? `${countWords[checked] ?? checked} of the ${sources.length} repositories run their checks on GitHub whenever the code changes, and the badge at the top of each of their READMEs shows the latest result. The others are checked by their own build scripts.`
    : 'Most repositories run their checks on GitHub whenever the code changes, and the badge at the top of each README shows the latest result.';
  const blocks = h('div', {class: 'method'},
    h('div', {}, h(sub, {}, 'Checks run on every push'), h('p', {}, ciText)),
    h('div', {}, h(sub, {}, 'A second tool re-checks'), h('p', {}, 'Where a number matters, a second tool checks it: Shapely for the flood map, gerbonara for the PCB fabrication files, a JSON Schema for the cleaner\'s report. The two Blender studies have no second tool; their own build scripts check them.')),
    h('div', {}, h(sub, {}, 'Every figure links to a file'), h('p', {}, 'Numbers here are read from files inside the repositories when this site is built. Each one links to its source, so you can open it and look.')));
  const parts = [h(onOwnPage ? 'h1' : 'h2', onOwnPage ? {tabindex: '-1'} : {}, 'How the numbers are checked'), h('p', {class: 'intro'}, 'A portfolio is easy to polish. These are the three habits that keep the figures honest.'), blocks];
  if (onOwnPage && sources.length) {
    parts.push(h('h2', {}, 'What this site was built from'),
      h('p', {class: 'intro'}, 'Everything on this site was read or copied from each repository at these commits. Open one to see the exact files.'),
      h('table', {class: 'register'}, h('thead', {}, h('tr', {}, h('th', {scope: 'col'}, 'Repository'), h('th', {scope: 'col'}, 'Commit'), h('th', {scope: 'col'}, 'Files used'))),
        h('tbody', {}, sources.map(s => h('tr', {}, h('th', {scope: 'row'}, h('a', {href: repoUrl(s.repo)}, s.repo)), h('td', {class: 'num', 'data-label': 'Commit'}, h('a', {href: `${repoUrl(s.repo)}/commit/${s.commit}`, target: '_blank', rel: 'noopener'}, s.commit.slice(0, 10))), h('td', {class: 'num', 'data-label': 'Files used'}, String(s.files)))))));
  }
  return h('section', {class: 'section', id: 'method'}, parts);
}

function renderHome(current) {
  const stage = h('div', {class: 'exhibit'});
  main.replaceChildren(
    h('section', {class: 'hero', 'data-p': 'sensor'},
      h('div', {},
        h('h1', {tabindex: '-1'}, 'Eight projects you can try, each with its proof'),
        config.name ? h('p', {class: 'by'}, `By ${config.name}${config.role ? `, ${config.role}` : ''}.`) : null,
        h('p', {class: 'lede'}, 'A circuit board, two 3D product studies, ad layouts and four software tools. Open one, use it, then open the file behind any number.'),
        h('div', {class: 'actions'}, h('a', {class: 'btn', href: `#/p/${projects[0].slug}`}, 'Take the tour'), h('a', {class: 'btn secondary', href: '#/all'}, 'See all projects')),
        h('p', {class: 'note'}, 'This page makes no outside requests and sets no cookies.')),
      stage),
    h('section', {class: 'section', id: 'all'}, h('h2', {}, 'All projects'),
      h('p', {class: 'intro'}, 'The tour goes through them in this order. Each opens with something to try and a list of the files that back it up.'),
      registerTable()),
    methodSection(false));
  const scrub = mountScrubber(stage, {
    frames: explodeFrames, ratio: '1120 / 712', label: 'Pull the sensor apart', endLabels: ['Assembled', 'Exploded'], valueText: explodeText, intro: true,
    caption: 'Cirrus C-01, rendered from the project\'s Blender file. Drag the picture or the slider.'
  });
  cleanup = () => scrub.destroy();
  document.title = `${config.name || 'Portfolio'}: a PCB, 3D product design, data tools and web apps you can try`;
  if (current.scrollTo) requestAnimationFrame(() => $('#' + current.scrollTo)?.scrollIntoView());
}

function renderMissing() {
  main.replaceChildren(h('section', {class: 'section'},
    h('h1', {tabindex: '-1'}, 'That page does not exist'),
    h('p', {class: 'intro'}, 'The link may be old or mistyped. The projects are all one click away.'),
    h('p', {class: 'actions'}, h('a', {class: 'btn', href: '#/all'}, 'See all projects'), h('a', {class: 'btn secondary', href: '#/p/' + projects[0].slug}, 'Take the tour'))));
  document.title = `Page not found: ${config.name || 'portfolio'}`;
}

async function renderProject(slug) {
  const index = projects.findIndex(p => p.slug === slug), p = projects[index];
  const prev = projects[index - 1], next = projects[index + 1];
  const exhibit = h('div', {class: 'exhibit'});
  const factItems = (facts[slug] ?? []);
  const wide = p.widget === 'embed';
  const repository = h('section', {}, h('p', {}, h('a', {class: 'btn', href: repoUrl(p.repo), target: '_blank', rel: 'noopener'}, 'Open the repository')), h('p', {class: 'built'}, `Built with ${p.stack}.`));
  // The repository link sits under the demo. A demo that takes the whole width keeps it with the notes.
  const page = h('div', {'data-p': slug},
    h('div', {class: 'crumbs'}, h('a', {href: '#/all'}, 'All projects'), h('span', {}, `Project ${index + 1} of ${projects.length}`)),
    h('div', {class: 'stage-head'}, h('h1', {tabindex: '-1'}, p.title), h('p', {class: 'kind'}, p.kind)),
    h('div', {class: wide ? 'stage wide' : 'stage'}, wide ? exhibit : h('div', {class: 'exhibit-col'}, exhibit, repository),
      h('aside', {class: 'notes', 'aria-label': 'About this project'},
        h('section', {}, h('h2', {}, 'What it is'), h('p', {}, p.summary)),
        h('section', {}, h('h2', {}, 'Try this'), h('ol', {class: 'try'}, p.tryIt.map(t => h('li', {}, h('span', {}, t))))),
        factItems.length ? h('section', {}, h('h2', {}, 'Checked by'), h('dl', {class: 'facts'}, factItems.map(f => h('div', {},
          h('dt', {}, f.label), h('dd', {}, f.value, ' ', f.path ? h('a', {href: repoUrl(p.repo, f.path), 'aria-label': `Source file for ${f.label}`, target: '_blank', rel: 'noopener'}, 'source') : null))))) : null,
        h('section', {}, h('h2', {}, 'Evidence you can open'), h('ul', {class: 'evidence'}, p.evidence.map(e => h('li', {},
          h('a', {href: repoUrl(p.repo, e.path), target: '_blank', rel: 'noopener'}, e.label), h('span', {}, e.note))))),
        wide ? repository : null)),
    h('nav', {class: 'hop', 'aria-label': 'Move through the tour'},
      prev ? h('a', {href: `#/p/${prev.slug}`, rel: 'prev'}, h('small', {}, 'Previous project'), prev.title) : h('span', {}),
      next ? h('a', {href: `#/p/${next.slug}`, rel: 'next'}, h('small', {}, 'Next project'), next.title) : h('a', {href: '#/all'}, h('small', {}, 'End of the tour'), 'Back to all projects')));
  document.title = `${p.title}: ${config.name || 'portfolio'}`;
  // The demo is built before the page is shown, so nothing below it moves when it arrives.
  main.setAttribute('aria-busy', 'true');
  try {
    const module = await import(`./widgets/${widgetFiles[p.widget]}`);
    const instance = await module.default(exhibit, {project: p, facts: facts[slug] ?? []});
    cleanup = () => instance?.destroy?.();
  } catch (error) {
    console.error(error);
    exhibit.replaceChildren(h('p', {class: 'caption'}, 'This demo did not load. The repository link on the right has the source and a README that explains it.'));
  }
  main.replaceChildren(page);
  main.removeAttribute('aria-busy');
}

let rendering = Promise.resolve();
let firstRender = true;
async function render() {
  const current = route();
  cleanup(); cleanup = () => {};
  setChrome(current);
  if (current.name === 'project') await renderProject(current.slug);
  else if (current.name === 'missing') renderMissing();
  else if (current.name === 'method') {
    main.replaceChildren(methodSection(true));
    document.title = `How the numbers are checked: ${config.name || 'portfolio'}`;
  } else renderHome(current);
  if (!current.scrollTo && !firstRender) {
    window.scrollTo(0, 0);
    const heading = main.querySelector('h1, h2');
    heading?.focus({preventScroll: true});
  }
  firstRender = false;
  announce(current.name === 'project' ? `${bySlug[current.slug].title}, project ${projects.findIndex(p => p.slug === current.slug) + 1} of ${projects.length}` : document.title);
}

$('.skip').addEventListener('click', event => { event.preventDefault(); main.focus(); main.scrollIntoView(); });
await loadData();
window.addEventListener('hashchange', () => { rendering = rendering.then(render); });
await render();

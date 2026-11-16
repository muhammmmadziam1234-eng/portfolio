import config from '../../site.config.js';
import {projects, bySlug, groups, groupOf} from './projects.js';
import {h, $, announce, repoUrl, reducedMotion} from './util.js';
import {mountScrubber} from './widgets/scrubber.js';
import {explodeFrames, explodeText} from './media.js';

const widgetFiles = {sensor: 'sensor.js', lamp: 'lamp.js', ads: 'ads.js', pcb: 'pcb.js', embed: 'embed.js', geojson: 'geojson.js', recording: 'recording.js'};
const main = $('#main');
const siteName = config.name || 'Portfolio';
const external = {target: '_blank', rel: 'noopener'};
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
  if (hash === 'about') return {name: 'about'};
  if (hash === 'all') return {name: 'home', scrollTo: 'work'};
  if (hash === 'contact') return {name: 'home', scrollTo: 'contact'};
  if (hash === '' || hash === '/') return {name: 'home'};
  return {name: 'missing'};
}

function setMeta(title, description) {
  document.title = title;
  $('meta[name=description]').setAttribute('content', description);
}

/* ---------- header, menu and footer ---------- */
const toggle = $('.menu-toggle');
const navList = $('#site-nav');
function setMenu(open, {returnFocus = false} = {}) {
  toggle.setAttribute('aria-expanded', String(open));
  navList.classList.toggle('open', open);
  if (!open && returnFocus) toggle.focus();
}
toggle.addEventListener('click', () => setMenu(toggle.getAttribute('aria-expanded') !== 'true'));
document.addEventListener('keydown', event => { if (event.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') setMenu(false, {returnFocus: true}); });
document.addEventListener('click', event => { if (toggle.getAttribute('aria-expanded') === 'true' && !event.target.closest('.site-header nav')) setMenu(false); });

function setupChrome() {
  $('#site-name').textContent = siteName;
  $('#foot-name').textContent = siteName;
  $('#foot-line').textContent = config.role || '';
  $('#foot-copy').textContent = `© 2026 ${config.name || config.githubUser}. All rights reserved.`;
  const upwork = $('#upwork');
  if (config.upworkUrl) Object.assign(upwork, {href: config.upworkUrl, target: '_blank', rel: 'noopener', hidden: false});
  $('#foot-links').replaceChildren(...[
    config.upworkUrl && h('li', {}, h('a', {href: config.upworkUrl, ...external}, 'Upwork')),
    h('li', {}, h('a', {href: `https://github.com/${config.githubUser}`, ...external}, 'GitHub')),
    config.email && h('li', {}, h('a', {href: `mailto:${config.email}`}, 'Email'))].filter(Boolean));
}

function markNav(current) {
  const target = {about: '#/about', method: '#/method', project: '#/all'}[current.name] ?? (current.scrollTo === 'work' ? '#/all' : current.scrollTo === 'contact' ? '#/contact' : '');
  for (const link of navList.querySelectorAll('a')) {
    if (link.getAttribute('href') === target) link.setAttribute('aria-current', current.name === 'project' ? 'true' : 'page');
    else link.removeAttribute('aria-current');
  }
}

/* ---------- shared pieces ---------- */
const tags = list => h('ul', {class: 'tags', 'aria-label': 'Tools'}, list.map(t => h('li', {class: 'tag'}, t)));
const sectionHead = (eyebrow, title, intro, id) => h('div', {class: 'section-head'},
  h('p', {class: 'eyebrow'}, eyebrow), h('h2', id ? {id, tabindex: '-1'} : {}, title), intro ? h('p', {class: 'intro'}, intro) : null);

function card(p) {
  return h('article', {class: 'card'},
    h('div', {class: 'card-media'}, h('img', {src: p.thumb, alt: '', width: 960, height: 720, loading: 'lazy', decoding: 'async'})),
    h('div', {class: 'card-body'},
      h('p', {class: 'card-kind'}, p.kind),
      h('h4', {class: 'card-title'}, h('a', {href: `#/p/${p.slug}`}, p.title)),
      h('p', {class: 'card-text'}, p.short),
      tags(p.tags)));
}

function feature(p) {
  const figure = (facts[p.slug] ?? [])[0];
  return h('article', {class: 'feature'},
    h('div', {class: 'feature-media'}, h('img', {src: p.thumb, alt: '', width: 960, height: 720, loading: 'lazy', decoding: 'async'})),
    h('div', {class: 'feature-body'},
      h('p', {class: 'card-kind'}, p.kind),
      h('h3', {class: 'feature-title'}, h('a', {href: `#/p/${p.slug}`}, p.title)),
      h('p', {class: 'feature-text'}, p.short),
      tags(p.tags.slice(0, 2)),
      figure ? h('div', {class: 'feature-stat'}, h('p', {class: 'value'}, figure.value), h('p', {class: 'label'}, figure.label)) : null,
      h('span', {class: 'link-arrow', 'aria-hidden': 'true'}, 'View project')));
}

function contactBand() {
  return h('section', {class: 'contact-band', 'aria-labelledby': 'contact'},
    h('div', {class: 'container'}, h('div', {class: 'contact-card'},
      h('div', {}, h('h2', {id: 'contact', tabindex: '-1'}, 'Have a project like these?'),
        h('p', {}, 'Tell me what you need and by when, and I will reply with how I would approach it and what I would check first.')),
      h('div', {class: 'actions'},
        config.upworkUrl ? h('a', {class: 'btn', href: config.upworkUrl, ...external}, 'Hire me on Upwork') : null,
        config.email ? h('a', {class: 'btn secondary', href: `mailto:${config.email}`}, 'Send an email') : null,
        !config.upworkUrl && !config.email ? h('a', {class: 'btn secondary', href: `https://github.com/${config.githubUser}`, ...external}, 'Find me on GitHub') : null))));
}

const countWords = ['No', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
function habits(level) {
  const checked = sources.filter(s => s.ci).length;
  const ciText = sources.length
    ? `${countWords[checked] ?? checked} of the ${String(countWords[sources.length] ?? sources.length).toLowerCase()} projects re-run their checks on GitHub whenever the code changes, and show the latest result at the top of their README. The others are checked by their own build scripts.`
    : 'Most projects re-run their checks on GitHub whenever the code changes, and show the latest result at the top of their README.';
  return h('div', {class: 'habits'},
    h('div', {class: 'habit'}, h(level, {}, 'Checks on every change'), h('p', {}, ciText)),
    h('div', {class: 'habit'}, h(level, {}, 'A second tool for key results'), h('p', {}, 'Where a number matters, a second tool checks it: Shapely for the flood map, gerbonara for the circuit board\'s fabrication files, and a JSON Schema for the data cleaner\'s report.')),
    h('div', {class: 'habit'}, h(level, {}, 'Figures you can trace'), h('p', {}, 'Every figure on this site is read from a file in the project\'s repository and links to it, so you can open the source and check.')));
}

/* ---------- home ---------- */
function renderHome(current) {
  const stage = h('div', {class: 'exhibit media'});
  const featured = (config.featured ?? []).map(slug => bySlug[slug]).filter(Boolean);
  main.replaceChildren(
    h('section', {class: 'hero'}, h('div', {class: 'container'},
      h('div', {},
        h('h1', {tabindex: '-1'}, siteName),
        config.role ? h('p', {class: 'role'}, config.role) : null,
        config.tagline ? h('p', {class: 'tagline'}, config.tagline) : null,
        h('div', {class: 'actions'}, h('a', {class: 'btn', href: '#/all'}, 'View work'), h('a', {class: 'btn secondary', href: '#/contact'}, 'Get in touch'))),
      stage)),
    featured.length ? h('section', {class: 'section', 'aria-labelledby': 'featured-title'}, h('div', {class: 'container'},
      sectionHead('Selected work', 'Three projects to start with', 'Each one opens with something you can try in the browser.', 'featured-title'),
      h('div', {class: 'features'}, featured.map(feature)))) : null,
    h('section', {class: 'section', 'aria-labelledby': 'work'}, h('div', {class: 'container'},
      sectionHead('All work', `${countWords[projects.length] ?? projects.length} projects in ${(countWords[groups.length] ?? groups.length).toLowerCase()} disciplines`, 'Every project has a live demo or a recording, and the files behind it.', 'work'),
      groups.map(g => h('div', {class: 'group'},
        h('div', {class: 'group-head'}, h('h3', {}, g.label), h('p', {}, g.intro)),
        h('div', {class: 'grid'}, projects.filter(p => p.group === g.id).map(card)))))),
    (config.services ?? []).length ? h('section', {class: 'section tinted', 'aria-labelledby': 'services-title'}, h('div', {class: 'container'},
      sectionHead('Services', 'What I can build for you', null, 'services-title'),
      h('div', {class: 'services'}, config.services.map(s => h('div', {class: 'service'}, h('h3', {}, s.title), h('p', {}, s.text)))))) : null,
    h('section', {class: 'section', 'aria-labelledby': 'habits-title'}, h('div', {class: 'container'},
      sectionHead('How I work', 'Work you can check', 'Three habits behind every project.', 'habits-title'),
      habits('h3'),
      h('a', {class: 'link-arrow', href: '#/method'}, 'How I verify my work'))),
    contactBand());
  const scrub = mountScrubber(stage, {
    frames: explodeFrames, ratio: '1120 / 712', label: 'Pull the sensor apart', endLabels: ['Assembled', 'Exploded'], valueText: explodeText, intro: true,
    caption: 'Cirrus C-01, rendered from the project\'s Blender file. Drag the picture or the slider.'
  });
  cleanup = () => scrub.destroy();
  setMeta(`${siteName}${config.role ? `: ${config.role.charAt(0).toLowerCase()}${config.role.slice(1)}` : ''}`,
    `${config.tagline || 'Eight projects you can try in the browser.'} Eight projects you can try in the browser, from a flood exposure map to a four-layer circuit board.`);
}

/* ---------- about ---------- */
function renderAbout() {
  const skills = groups.map(g => ({label: g.label, tags: [...new Set(projects.filter(p => p.group === g.id).flatMap(p => p.tags))]}));
  const facts = [['Based in', config.location], ['Availability', config.availability]].filter(([, v]) => v);
  main.replaceChildren(
    h('section', {class: 'page-head'}, h('div', {class: 'container about-grid'},
      h('div', {},
        h('h1', {tabindex: '-1'}, 'About'),
        h('p', {class: 'lead'}, config.bio || [config.role && `${siteName}, ${config.role.charAt(0).toLowerCase()}${config.role.slice(1)}.`, config.tagline].filter(Boolean).join(' ')),
        facts.length ? h('dl', {class: 'about-facts'}, facts.map(([k, v]) => h('div', {}, h('dt', {}, k), h('dd', {}, v)))) : null),
      config.photo ? h('img', {class: 'about-photo', src: config.photo, alt: `Photo of ${siteName}`, width: 360, height: 360}) : null)),
    h('section', {class: 'section', 'aria-labelledby': 'skills-title'}, h('div', {class: 'container'},
      sectionHead('Skills', 'Tools by discipline', 'Taken from the projects on this site.', 'skills-title'),
      h('div', {class: 'skills'}, skills.map(s => h('div', {}, h('h3', {}, s.label), tags(s.tags)))))),
    contactBand());
  setMeta(`About ${siteName}`, `About ${siteName}${config.role ? `, ${config.role.charAt(0).toLowerCase()}${config.role.slice(1)}` : ''}: skills by discipline and how to get in touch.`);
}

/* ---------- verification ---------- */
function renderMethod() {
  main.replaceChildren(
    h('section', {class: 'page-head'}, h('div', {class: 'container'},
      h('h1', {tabindex: '-1'}, 'Verification'),
      h('p', {class: 'lead'}, 'How the projects on this site are checked, and the exact versions the site was built from.'))),
    h('section', {class: 'section', 'aria-label': 'Three habits'}, h('div', {class: 'container'}, habits('h2'))),
    sources.length ? h('section', {class: 'section', 'aria-labelledby': 'built-from'}, h('div', {class: 'container'},
      sectionHead('Sources', 'What this site was built from', 'Everything here was read or copied from each repository at these commits. Open one to see the exact files.', 'built-from'),
      h('ul', {class: 'source-list'}, sources.map(s => h('li', {},
        h('a', {class: 'repo', href: repoUrl(s.repo), ...external}, s.repo),
        h('a', {class: 'commit', href: `${repoUrl(s.repo)}/commit/${s.commit}`, ...external, 'aria-label': `Commit ${s.commit.slice(0, 7)} of ${s.repo}`}, s.commit.slice(0, 7)),
        h('span', {class: 'count'}, `${s.files} file${s.files === 1 ? '' : 's'} used`)))),
      h('p', {class: 'note'}, 'This site makes no requests to other websites and sets no cookies.'))) : null,
    contactBand());
  setMeta(`Verification: ${siteName}`, 'How the projects on this site are checked: tests on every change, a second tool for key results, and figures that link to their source files.');
}

/* ---------- not found ---------- */
function renderMissing() {
  main.replaceChildren(h('section', {class: 'page-head'}, h('div', {class: 'container'},
    h('h1', {tabindex: '-1'}, 'That page does not exist'),
    h('p', {class: 'lead'}, 'The link may be old or mistyped. The projects are all one click away.'),
    h('div', {class: 'actions', style: null}, h('a', {class: 'btn', href: '#/all'}, 'See all projects'), h('a', {class: 'btn secondary', href: '#/'}, 'Go to the home page')))));
  main.querySelector('.actions').style.marginTop = '32px';
  setMeta(`Page not found: ${siteName}`, 'That page does not exist. The projects are all one click away.');
}

/* ---------- project ---------- */
async function renderProject(slug) {
  const index = projects.findIndex(p => p.slug === slug), p = projects[index];
  const prev = projects[index - 1], next = projects[index + 1];
  const exhibit = h('div', {class: 'exhibit'});
  const figures = facts[slug] ?? [];
  const pagerCard = (q, which) => h('a', {class: `pager-card ${which}`, href: `#/p/${q.slug}`, rel: which},
    h('img', {src: q.thumb, alt: '', width: 160, height: 120, loading: 'lazy', decoding: 'async'}),
    h('span', {}, h('small', {}, which === 'prev' ? 'Previous project' : 'Next project'), h('strong', {}, q.title)));
  const page = h('div', {},
    h('section', {class: 'project-head'}, h('div', {class: 'container'},
      h('nav', {class: 'crumbs', 'aria-label': 'Breadcrumb'}, h('ol', {}, h('li', {}, h('a', {href: '#/all'}, 'Work')), h('li', {}, groupOf[p.group].label))),
      h('h1', {tabindex: '-1'}, p.title),
      h('p', {class: 'kind'}, p.kind),
      tags(p.tags),
      h('div', {class: 'actions'},
        h('a', {class: 'btn secondary', href: repoUrl(p.repo), ...external}, 'Open the repository'),
        p.embed ? h('a', {class: 'btn secondary', href: p.embed, ...external}, 'Open full screen') : null))),
    h('div', {class: 'container'}, exhibit),
    h('div', {class: 'container project-body'},
      h('div', {},
        h('section', {}, h('h2', {}, 'Overview'), h('p', {class: 'summary'}, p.summary)),
        h('section', {}, h('h2', {}, 'Try this'), h('ol', {class: 'try'}, p.tryIt.map(t => h('li', {}, h('span', {}, t))))),
        h('section', {}, h('h2', {}, 'Source files'), h('ul', {class: 'files'}, p.evidence.map(e => h('li', {},
          h('a', {href: repoUrl(p.repo, e.path), ...external}, e.label), h('span', {}, e.note)))))),
      figures.length ? h('section', {'aria-labelledby': 'figures-title'}, h('h2', {id: 'figures-title'}, 'Verified figures'),
        h('dl', {class: 'stats'}, figures.map(f => h('div', {class: 'stat'},
          h('dt', {}, f.label), h('dd', {class: 'value'}, f.value),
          f.path ? h('dd', {class: 'source'}, h('a', {href: repoUrl(p.repo, f.path), ...external, 'aria-label': `Source file for ${f.label}`}, 'Source file')) : null)))) : h('div')),
    h('nav', {class: 'container pager', 'aria-label': 'More projects'},
      prev ? pagerCard(prev, 'prev') : h('span'),
      next ? pagerCard(next, 'next') : h('a', {class: 'pager-card next', href: '#/all'}, h('span', {}, h('small', {}, 'End of the projects'), h('strong', {}, 'Back to all work')))),
    contactBand());
  setMeta(`${p.title}: ${siteName}`, `${p.short} ${p.summary}`);
  // The demo is built before the page is shown, so nothing below it moves when it arrives.
  main.setAttribute('aria-busy', 'true');
  try {
    const module = await import(`./widgets/${widgetFiles[p.widget]}`);
    const instance = await module.default(exhibit, {project: p, facts: figures});
    cleanup = () => instance?.destroy?.();
  } catch (error) {
    console.error(error);
    exhibit.replaceChildren(h('p', {class: 'caption'}, 'This demo did not load. The repository has the source and a README that explains it.'));
  }
  main.replaceChildren(page);
  main.removeAttribute('aria-busy');
}

/* ---------- router ---------- */
let rendering = Promise.resolve();
let firstRender = true;
async function render() {
  const current = route();
  cleanup(); cleanup = () => {};
  setMenu(false);
  markNav(current);
  if (current.name === 'project') await renderProject(current.slug);
  else if (current.name === 'missing') renderMissing();
  else if (current.name === 'method') renderMethod();
  else if (current.name === 'about') renderAbout();
  else renderHome(current);
  if (!firstRender && !reducedMotion()) {
    main.classList.remove('entering'); void main.offsetWidth; main.classList.add('entering');
  }
  if (current.scrollTo) {
    const target = document.getElementById(current.scrollTo);
    requestAnimationFrame(() => { target?.scrollIntoView(); if (!firstRender) target?.focus({preventScroll: true}); });
  } else if (!firstRender) {
    window.scrollTo(0, 0);
    main.querySelector('h1')?.focus({preventScroll: true});
  }
  firstRender = false;
  announce(current.name === 'project' ? `${bySlug[current.slug].title}, project ${projects.findIndex(p => p.slug === current.slug) + 1} of ${projects.length}` : document.title);
}

setupChrome();
$('.skip').addEventListener('click', event => { event.preventDefault(); main.focus(); main.scrollIntoView(); });
main.addEventListener('animationend', () => main.classList.remove('entering'));
await loadData();
window.addEventListener('hashchange', () => { rendering = rendering.then(render); });
await render();

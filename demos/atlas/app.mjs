// The page: draws the map, list and tables and wires the controls. The analysis is in geo.mjs, the import checks are in
// validate.mjs, and imported data is analysed off the main thread by worker.mjs (which runs job.mjs).
import {analyze, withChange} from './geo.mjs';
import {sites as sampleSites, zones as sampleZones, expandedZones as sampleExpanded, project as sampleProject,
  land, river, roads, width, height} from './scenario.mjs';
import {checkSize} from './validate.mjs';
import {toCsv, toGeoJSON, encodeState, decodeState} from './codec.mjs';
import {extentOf, fitProjection, geometryPath} from './view.mjs';

/** @typedef {import('./geo.mjs').Site} Site */
/** @typedef {import('./geo.mjs').Zone} Zone */
/** @typedef {import('./geo.mjs').Result} Result */
/** @typedef {import('./geo.mjs').Exposure} Exposure */
/** @typedef {import('./view.mjs').Projection} Projection */
/** @typedef {import('./job.mjs').Job} Job */
/** @typedef {import('./job.mjs').WorkerMessage} WorkerMessage */
/** @typedef {import('./job.mjs').LayerReport} LayerReport */
/** @typedef {import('./job.mjs').ZoneSet} ZoneSet */
/**
 * @template T
 * @typedef {import('./geo.mjs').Collection<T>} Collection
 */
/**
 * Everything on screen: both layers, their results and how to draw them.
 * @typedef {object} Dataset
 * @property {Collection<Site>} sites
 * @property {Collection<Result>} baseline
 * @property {Collection<Result>|null} expanded null when the zones were imported: they are one scenario
 * @property {ZoneSet} zones
 * @property {{facilities: 'sample'|'imported', zones: 'sample'|'imported'}} source
 * @property {boolean} artwork true while both layers are the sample, which has a drawn basemap
 * @property {Projection} project
 */

const ROW_CAP = 200, MARKER_CAP = 1000, ZONE_CAP = 3000;
/** @type {Record<Exposure, string>} */
const levels = {outside: 'Outside', low: 'Low', moderate: 'Moderate', high: 'High'};
const number = (/** @type {number} */ n) => n.toLocaleString('en-US');

const $ = (/** @type {string} */ id) => {
  const node = document.getElementById(id);
  if (!node) throw new Error('Missing element #' + id);
  return node;
};
const fieldOf = (/** @type {string} */ id) => /** @type {HTMLInputElement} */ ($(id));
const choiceOf = (/** @type {string} */ id) => /** @type {HTMLSelectElement} */ ($(id));
const map = /** @type {SVGSVGElement} */ (/** @type {unknown} */ ($('map')));
const list = $('facilities'), markerBox = $('markers'), count = $('count'), detail = $('detail');
const filterSelect = choiceOf('filter'), scenarioSelect = choiceOf('scenario'), zonesToggle = fieldOf('zones');
const progress = /** @type {HTMLProgressElement} */ ($('progress')), runText = $('run-text'), statusLine = $('import-status');

/** @param {string} tag @param {string} [text] @param {string} [cls] */
function el(tag, text = '', cls = '') {
  const node = document.createElement(tag);
  if (text) node.textContent = text;
  if (cls) node.className = cls;
  return node;
}
const ns = 'http://www.w3.org/2000/svg';
/** @param {string} tag @param {Record<string, string|number>} attrs @param {Element} [parent] */
function svg(tag, attrs, parent = map) {
  const node = document.createElementNS(ns, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
  parent.append(node);
  return node;
}
const path = (/** @type {number[][]} */ points) => points.map(([x, y], i) => (i ? 'L' : 'M') + x.toFixed(2) + ' ' + y.toFixed(2)).join(' ') + ' Z';

// ---- Map drawing: the sample basemap sits below and above the zone layer; imported data gets a plain background ----
const defs = svg('defs', {}), clip = svg('clipPath', {id: 'land-mask'}, defs);
svg('path', {d: path(land)}, clip);
const below = svg('g', {});
svg('rect', {width, height, fill: '#174c5e'}, below);
svg('path', {d: path(land), fill: '#e8e6d4', stroke: '#a9ad8d', 'stroke-width': 3}, below);
const terrain = svg('g', {'clip-path': 'url(#land-mask)'}, below);
for (let i = -6; i < 23; i++) {
  const y = i * 38;
  svg('path', {d: 'M 174 ' + y + ' Q 570 ' + (y - 76) + ' 1040 ' + (y + 125), class: 'contour'}, terrain);
}
for (let i = 0; i < 30; i++) {
  const x = 170 + i * 34;
  svg('path', {d: 'M ' + x + ' -10 Q ' + (x + 96) + ' 280 ' + (x - 52) + ' 690', class: 'street'}, terrain);
}
const plain = svg('rect', {width, height, class: 'plain-bg'});
const zoneLayer = svg('g', {id: 'map-zones'});
const above = svg('g', {});
for (const d of roads) { svg('path', {d, class: 'road-border'}, above); svg('path', {d, class: 'road'}, above); }
svg('path', {d: river, class: 'river-bank'}, above); svg('path', {d: river, class: 'river'}, above);
for (const [x, y, t, c] of [[65, 401, 'Alder Bay', 'water-label'], [318, 283, 'Westgate', 'place'], [595, 155, 'Northridge', 'place'],
  [799, 393, 'Eastbank', 'place'], [738, 584, 'Briar Marsh', 'place']]) svg('text', {x, y, class: c}, above).textContent = String(t);
svg('path', {d: 'M 914 597 v 29 h 51 v -8', class: 'scale'}, above);
svg('text', {x: 917, y: 648, class: 'scale-label'}, above).textContent = '200 m';
svg('path', {d: 'M 941 58 l -9 23 9 -5 9 5 Z', fill: '#243a3b'}, above);
svg('text', {x: 936, y: 53, class: 'scale-label'}, above).textContent = 'N';

// ---- State ----
/** @returns {Dataset} */
function sampleDataset() {
  const baseline = analyze(sampleSites, sampleZones);
  return {sites: sampleSites, baseline, expanded: withChange(baseline, analyze(sampleSites, sampleExpanded)),
    zones: {baseline: sampleZones, expanded: sampleExpanded}, source: {facilities: 'sample', zones: 'sample'}, artwork: true, project: sampleProject};
}
let data = sampleDataset();
const state = {
  scenario: /** @type {import('./codec.mjs').Scenario} */ ('baseline'),
  level: /** @type {import('./codec.mjs').LevelFilter} */ ('all'),
  selected: /** @type {string|null} */ (null),
  zoom: 1
};
/** @type {Result[]} */ let lastVisible = [];
/** @type {{node: HTMLElement, x: number, y: number}[]} */ let markers = [];
/** @type {Worker|null} */ let running = null;

const results = () => state.scenario === 'expanded' && data.expanded ? data.expanded : data.baseline;
const signed = (/** @type {number} */ n) => (n > 0 ? '+' : '') + n;

function renderZones() {
  zoneLayer.replaceChildren();
  const zones = state.scenario === 'expanded' && data.zones.expanded ? data.zones.expanded : data.zones.baseline;
  for (const f of zones.features.slice(0, ZONE_CAP)) {
    const node = svg('path', {d: geometryPath(f.geometry, data.project), class: 'zone ' + f.properties.level, 'fill-rule': 'evenodd'}, zoneLayer);
    svg('title', {}, node).textContent = f.properties.name;
  }
}

function render() {
  const all = results().features;
  const visible = state.level === 'all' ? all : all.filter(f => f.properties.exposure === state.level);
  lastVisible = visible;
  if (!visible.some(f => f.properties.id === state.selected)) state.selected = visible[0]?.properties.id ?? null;
  const picked = visible.find(f => f.properties.id === state.selected);
  const summary = number(visible.length) + ' of ' + number(all.length) + ' facilities shown. ' +
    (state.level === 'all' ? 'All exposure levels' : levels[state.level] + ' exposure') +
    (data.expanded ? ', ' + (state.scenario === 'expanded' ? 'expanded extent' : 'baseline') : '') + '.' +
    (visible.length > ROW_CAP ? ' The list shows the first ' + ROW_CAP + ' and the map the first ' + number(MARKER_CAP) + '; exports include all.' : '');
  if (count.textContent !== summary) count.textContent = summary;

  const active = document.activeElement;
  const focus = active instanceof HTMLElement && active.dataset.site !== undefined ? {id: active.dataset.site, onMap: markerBox.contains(active)} : null;
  const part = (/** @type {number} */ cap) => {
    const first = visible.slice(0, cap);
    if (picked && !first.includes(picked)) first.push(picked);
    return first;
  };

  const rows = document.createDocumentFragment();
  for (const f of part(ROW_CAP)) {
    const {id, name, category, exposure} = f.properties, on = id === state.selected;
    const row = document.createElement('button');
    row.type = 'button'; row.className = 'facility'; row.dataset.site = id;
    row.setAttribute('aria-pressed', String(on)); row.tabIndex = on ? 0 : -1;
    const info = el('span'); info.append(el('strong', name), el('small', category));
    row.append(info, el('span', levels[exposure], 'level ' + exposure));
    rows.append(row);
  }
  list.replaceChildren(rows);

  const dots = document.createDocumentFragment();
  markers = [];
  for (const f of part(MARKER_CAP)) {
    const {id, name, category, exposure} = f.properties, on = id === state.selected;
    const [x, y] = data.project(f.geometry.coordinates);
    const dot = document.createElement('button');
    dot.type = 'button'; dot.className = 'marker ' + exposure; dot.dataset.site = id; dot.title = name;
    dot.setAttribute('aria-label', name + ', ' + category + ', ' + (exposure === 'outside' ? 'outside all modeled zones' : levels[exposure] + ' exposure'));
    dot.setAttribute('aria-pressed', String(on)); dot.tabIndex = on ? 0 : -1;
    dots.append(dot);
    markers.push({node: dot, x, y});
  }
  markerBox.replaceChildren(dots);
  if (focus) {
    for (const node of (focus.onMap ? markerBox : list).children)
      if (node instanceof HTMLElement && node.dataset.site === focus.id) { node.focus({preventScroll: true}); break; }
  }

  detail.replaceChildren();
  if (!picked) { detail.append(el('p', 'No facilities match this filter.')); return; }
  const {name, matchedZones, baselineExposure, exposure} = picked.properties;
  detail.append(el('small', 'Selected facility'), el('h3', name),
    el('p', matchedZones.length ? 'Intersecting zones: ' + matchedZones.join(', ') + '.' : 'Outside all modeled zones.'));
  if (baselineExposure) detail.append(el('p', 'Baseline: ' + levels[baselineExposure] + ' / Expanded: ' + levels[exposure] + '.', 'comparison'));
}

function view() {
  const target = results().features.find(f => f.properties.id === state.selected);
  const [x, y] = target ? data.project(target.geometry.coordinates) : [width / 2, height / 2];
  const w = width / state.zoom, h = height / state.zoom;
  const clamp = (/** @type {number} */ a, /** @type {number} */ b) => Math.max(0, Math.min(a, b));
  const vx = clamp(x - w / 2, width - w), vy = clamp(y - h / 2, height - h);
  map.setAttribute('viewBox', [vx, vy, w, h].join(' '));
  for (const m of markers) {
    const left = (m.x - vx) / w * 100, top = (m.y - vy) / h * 100;
    const inside = left >= -1 && left <= 101 && top >= -1 && top <= 101;
    m.node.hidden = !inside;
    if (inside) { m.node.style.left = left.toFixed(3) + '%'; m.node.style.top = top.toFixed(3) + '%'; }
  }
  fieldOf('zoom-in').disabled = state.zoom === 3; fieldOf('zoom-out').disabled = state.zoom === 1;
}

// ---- Comparison tables ----
/** @param {string[]} cells @param {boolean} [head] @param {string[]} [classes] */
function tableRow(cells, head = false, classes = []) {
  const tr = el('tr');
  cells.forEach((text, i) => {
    const cell = el(head ? 'th' : 'td', text, classes[i] ?? '');
    if (head) cell.setAttribute('scope', 'col');
    tr.append(cell);
  });
  return tr;
}
/** @param {Result[]} features */
function tally(features) {
  const t = {high: 0, moderate: 0, low: 0, outside: 0};
  for (const f of features) t[f.properties.exposure]++;
  return t;
}
function renderComparison() {
  const countsTable = $('counts'), changesTable = $('changes');
  const base = tally(data.baseline.features), alt = data.expanded ? tally(data.expanded.features) : null;
  $('comparison-title').textContent = alt ? 'Scenario comparison' : 'Exposure counts';
  $('comparison-note').textContent = alt ? '' : 'Imported zones are analysed as one scenario, so there is no expanded extent to compare.';
  const body = el('tbody');
  for (const level of /** @type {const} */ (['high', 'moderate', 'low', 'outside']))
    body.append(alt ? tableRow([levels[level], String(base[level]), String(alt[level]), signed(alt[level] - base[level])], false, ['', 'num', 'num', 'num'])
      : tableRow([levels[level], String(base[level])], false, ['', 'num']));
  body.append(alt ? tableRow(['All facilities', String(data.baseline.features.length), String(data.baseline.features.length), '0'], false, ['', 'num', 'num', 'num'])
    : tableRow(['All facilities', String(data.baseline.features.length)], false, ['', 'num']));
  const thead = el('thead');
  thead.append(alt ? tableRow(['Level', 'Baseline', 'Expanded', 'Change'], true, ['', 'num', 'num', 'num']) : tableRow(['Level', 'Facilities'], true, ['', 'num']));
  countsTable.replaceChildren(el('caption', 'Facilities per exposure level'), thead, body);

  if (!data.expanded) { changesTable.replaceChildren(); return; }
  const changed = data.expanded.features.filter(f => f.properties.exposureChange)
    .sort((a, b) => (b.properties.exposureChange ?? 0) - (a.properties.exposureChange ?? 0) || a.properties.name.localeCompare(b.properties.name, 'en'));
  const rows = el('tbody');
  for (const f of changed.slice(0, 100)) {
    const {name, baselineExposure, exposure, exposureChange = 0} = f.properties;
    const tr = tableRow([name, levels[baselineExposure ?? 'outside'] + ' to ' + levels[exposure], signed(exposureChange)], false, ['', '', 'num ' + (exposureChange > 0 ? 'up' : 'down')]);
    rows.append(tr);
  }
  if (changed.length > 100) rows.append(tableRow(['and ' + number(changed.length - 100) + ' more (all rows are in the CSV export)', '', '']));
  if (!changed.length) rows.append(tableRow(['No facility changes exposure.', '', '']));
  const head = el('thead');
  head.append(tableRow(['Facility', 'Baseline to expanded', 'Change'], true, ['', '', 'num']));
  changesTable.replaceChildren(el('caption', number(changed.length) + ' of ' + number(data.expanded.features.length) + ' facilities change exposure'), head, rows);
}

function updateNote() {
  const changed = data.expanded?.features.filter(f => f.properties.exposureChange !== 0).length ?? 0;
  $('scenario-note').textContent = !data.expanded ? 'Imported zones are analysed as one scenario.' :
    state.scenario === 'expanded' ? changed + ' of ' + data.expanded.features.length + ' facilities change exposure from baseline.' : '';
}

// ---- Dataset, URL state and refresh ----
function currentHash() {
  const first = lastVisible[0]?.properties.id;
  return encodeState({scenario: state.scenario, level: state.level, site: state.selected && state.selected !== first ? state.selected : null});
}
function syncHash() {
  const hash = currentHash();
  if (hash !== location.hash) history.replaceState(null, '', hash || location.pathname + location.search);
}
function refresh() { render(); view(); syncHash(); }

function applyDataset() {
  const imported = !data.artwork;
  for (const group of [below, above]) /** @type {SVGElement} */ (group).style.display = imported ? 'none' : '';
  /** @type {SVGElement} */ (plain).style.display = imported ? '' : 'none';
  map.parentElement?.classList.toggle('plain', imported);
  const {facilities, zones} = data.source;
  $('source-badge').textContent = !imported ? 'Fictional study area' : facilities === 'imported' && zones === 'imported' ? 'Imported facilities and zones' :
    facilities === 'imported' ? 'Imported facilities, sample zones' : 'Sample facilities, imported zones';
  $('map-heading').textContent = imported ? 'Imported data' : 'Lower Alder watershed';
  $('map-title').textContent = imported ? 'Map of the imported data, drawn without a basemap. Select a facility in the list to locate it.' :
    'Fictional Lower Alder watershed map. Select a facility in the list to locate it.';
  const note = $('map-note');
  note.hidden = !imported;
  if (imported) {
    const extent = extentOf(data.sites.features, [...data.zones.baseline.features, ...(data.zones.expanded?.features ?? [])]);
    note.textContent = 'Drawn without a basemap and fitted to the data' + (extent ? ': longitude ' + extent[0].toFixed(4) + ' to ' + extent[2].toFixed(4) +
      ', latitude ' + extent[1].toFixed(4) + ' to ' + extent[3].toFixed(4) + '.' : '.');
  }
  scenarioSelect.disabled = !data.expanded;
  if (!data.expanded) state.scenario = 'baseline';
  scenarioSelect.value = state.scenario; filterSelect.value = state.level;
  renderZones(); renderComparison(); updateNote(); refresh();
}

/** @param {Extract<WorkerMessage, {type: 'result'}>} msg */
function adopt(msg) {
  const sites = msg.sites ?? data.sites, zones = msg.zones ?? data.zones;
  const source = {facilities: msg.sites ? 'imported' : data.source.facilities, zones: msg.zones ? 'imported' : data.source.zones};
  const artwork = source.facilities === 'sample' && source.zones === 'sample';
  const extent = artwork ? null : extentOf(sites.features, [...zones.baseline.features, ...(zones.expanded?.features ?? [])]);
  data = {sites, baseline: msg.baseline, expanded: msg.expanded, zones, artwork, project: artwork || !extent ? sampleProject : fitProjection(extent, width, height),
    source: /** @type {Dataset['source']} */ (source)};
  state.selected = null; state.zoom = 1;
  applyDataset();
}

// ---- Import: files go to a module worker; the page stays responsive and the run can be cancelled ----
const status = (/** @type {string} */ text) => { statusLine.textContent = text; };
function setBusy(/** @type {boolean} */ on) {
  $('run').hidden = !on;
  for (const id of ['file-facilities', 'file-zones']) fieldOf(id).disabled = on;
  if (on) { progress.value = 0; runText.textContent = 'Starting…'; }
}
function stopWorker() {
  running?.terminate();
  running = null;
  setBusy(false);
}
/** @param {LayerReport[]} reports */
function showProblems(reports) {
  const bad = reports.filter(r => r.problems.length);
  $('problems').hidden = bad.length === 0;
  const rows = $('problem-rows');
  rows.replaceChildren();
  const lines = [];
  for (const r of bad) {
    const name = r.layer === 'facilities' ? 'Facilities' : 'Zones';
    for (const p of r.problems) rows.append(tableRow([name, p.index === null ? 'whole file' : String(p.index), p.field, p.message]));
    lines.push(name + ': ' + number(r.rejected) + ' of ' + number(r.total) + ' features rejected' +
      (r.omittedProblems ? ', and ' + number(r.omittedProblems) + ' more problems are not listed' : ''));
  }
  $('problems-summary').textContent = lines.join('. ') + (lines.length ? '.' : '');
}
/** @param {Extract<WorkerMessage, {type: 'result'}>} msg @param {string} fileName */
function describe(msg, fileName) {
  const parts = msg.reports.map(r => (r.layer === 'facilities' ? 'Facilities' : 'Zones') + ': ' + number(r.accepted) + ' of ' + number(r.total) +
    ' features accepted' + (r.rejected ? ', ' + number(r.rejected) + ' rejected' : ''));
  return 'Imported ' + fileName + '. ' + parts.join('; ') + '. ' + number(msg.baseline.features.length) + ' facilities analysed in ' + Math.round(msg.elapsedMs) + ' ms.';
}
/** @param {WorkerMessage} msg @param {string} fileName */
function onMessage(msg, fileName) {
  switch (msg.type) {
    case 'status': runText.textContent = msg.message; break;
    case 'progress': {
      const pct = msg.total ? Math.round(msg.done / msg.total * 100) : 100;
      progress.value = pct; runText.textContent = 'Analysing… ' + pct + '%';
      break;
    }
    case 'rejected':
      stopWorker(); showProblems(msg.reports);
      status('Nothing was imported from ' + fileName + '. The previous data is still shown.');
      break;
    case 'result':
      stopWorker(); adopt(msg); showProblems(msg.reports); status(describe(msg, fileName));
      break;
    case 'error':
      stopWorker(); status('The analysis stopped: ' + msg.message + ' The previous data is still shown.');
      break;
  }
}
/** @param {Job} job @param {string} fileName */
function startJob(job, fileName) {
  try {
    const worker = new Worker(new URL('./worker.mjs', import.meta.url), {type: 'module'});
    running = worker;
    setBusy(true);
    worker.onmessage = event => onMessage(event.data, fileName);
    worker.onerror = event => {
      stopWorker();
      status('The analysis worker could not run' + (event.message ? ' (' + event.message + ')' : '') + '. Serve this folder over http, for example with npm start; module workers do not start from a file URL.');
    };
    worker.postMessage(job);
  } catch (error) {
    stopWorker();
    status('The analysis worker could not start: ' + (error instanceof Error ? error.message : String(error)));
  }
}
/** @param {'facilities'|'zones'} layer @param {File} file */
async function importLayer(layer, file) {
  if (running) { status('An analysis is already running. Cancel it first.'); return; }
  showProblems([]);
  const tooBig = checkSize(file.size);
  if (tooBig) {
    showProblems([{layer, total: 0, accepted: 0, rejected: 0, problems: [tooBig], omittedProblems: 0}]);
    status('Nothing was imported from ' + file.name + '. The previous data is still shown.');
    return;
  }
  let text;
  try { text = await file.text(); } catch { status('Could not read ' + file.name + '.'); return; }
  status('');
  startJob({type: 'run', facilities: layer === 'facilities' ? {text} : {collection: data.sites}, zones: layer === 'zones' ? {text} : data.zones}, file.name);
}

for (const layer of /** @type {const} */ (['facilities', 'zones'])) {
  const picker = fieldOf('file-' + layer), zone = $('drop-' + layer);
  picker.addEventListener('change', () => {
    const file = picker.files?.[0];
    picker.value = '';
    if (file) importLayer(layer, file);
  });
  zone.addEventListener('dragover', event => { event.preventDefault(); zone.classList.add('over'); });
  zone.addEventListener('dragleave', () => zone.classList.remove('over'));
  zone.addEventListener('drop', event => {
    event.preventDefault(); zone.classList.remove('over');
    const file = event.dataTransfer?.files[0];
    if (file) importLayer(layer, file);
  });
}
for (const type of ['dragover', 'drop']) window.addEventListener(type, event => event.preventDefault()); // a stray drop must not open the file
$('cancel').onclick = () => { if (running) { stopWorker(); status('Analysis cancelled. The previous data is still shown.'); } };
$('reset-sample').onclick = () => {
  stopWorker();
  data = sampleDataset();
  state.level = 'all'; state.scenario = 'baseline'; state.selected = null; state.zoom = 1;
  showProblems([]); status('Showing the sample scenario.');
  applyDataset();
};

// ---- Selection, keyboard and controls ----
/** @param {string} id */
function select(id) { state.selected = id; refresh(); }
for (const box of [list, markerBox]) {
  box.addEventListener('click', event => {
    const target = event.target instanceof Element ? event.target.closest('[data-site]') : null;
    if (target instanceof HTMLElement && target.dataset.site !== undefined) select(target.dataset.site);
  });
  // One tab stop per group (roving tabindex); arrows, Home and End move between facilities, Enter and Space select.
  box.addEventListener('keydown', event => {
    const items = /** @type {HTMLElement[]} */ ([...box.querySelectorAll('[data-site]')].filter(n => n instanceof HTMLElement && !n.hidden));
    const at = items.findIndex(n => n === document.activeElement);
    if (at < 0) return;
    let next = at;
    switch (event.key) {
      case 'ArrowDown': case 'ArrowRight': next = at + 1; break;
      case 'ArrowUp': case 'ArrowLeft': next = at - 1; break;
      case 'Home': next = 0; break;
      case 'End': next = items.length - 1; break;
      default: return;
    }
    event.preventDefault();
    const target = items[Math.max(0, Math.min(items.length - 1, next))];
    for (const n of items) n.tabIndex = n === target ? 0 : -1;
    target.focus();
  });
}
$('zoom-in').onclick = () => { state.zoom = Math.min(3, state.zoom + 0.5); view(); };
$('zoom-out').onclick = () => { state.zoom = Math.max(1, state.zoom - 0.5); view(); };
$('reset').onclick = () => { state.zoom = 1; view(); };
filterSelect.onchange = () => { state.level = /** @type {import('./codec.mjs').LevelFilter} */ (filterSelect.value); refresh(); };
zonesToggle.onchange = () => { zoneLayer.style.display = zonesToggle.checked ? '' : 'none'; };
scenarioSelect.onchange = () => {
  state.scenario = scenarioSelect.value === 'expanded' && data.expanded ? 'expanded' : 'baseline';
  renderZones(); updateNote(); refresh();
};
/** @param {string} name @param {string} type @param {string} text */
function download(name, type, text) {
  const url = URL.createObjectURL(new Blob([text], {type}));
  const a = document.createElement('a');
  a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
const stem = () => data.artwork ? 'alder-coast-exposure' : 'exposure-results';
$('export').onclick = () => download(stem() + '.geojson', 'application/geo+json', toGeoJSON(lastVisible));
$('export-csv').onclick = () => download(stem() + '.csv', 'text/csv;charset=utf-8', toCsv(lastVisible));
window.addEventListener('hashchange', () => {
  const wanted = decodeState(location.hash);
  state.scenario = wanted.scenario === 'expanded' && data.expanded ? 'expanded' : 'baseline';
  state.level = wanted.level; state.selected = wanted.site;
  scenarioSelect.value = state.scenario; filterSelect.value = state.level;
  renderZones(); updateNote(); refresh();
});

// ---- First paint: the sample is analysed here, on the main thread, and no worker is involved ----
{
  const wanted = decodeState(location.hash);
  state.scenario = wanted.scenario; state.level = wanted.level; state.selected = wanted.site;
  applyDataset();
}

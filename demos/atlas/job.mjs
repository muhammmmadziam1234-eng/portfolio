// One import job: validate the layers that arrive as text, then run the spatial join. It posts messages through a
// callback and never touches the page, so worker.mjs can run it off the main thread and tests can run it directly.
import {analyze, withChange} from './geo.mjs';
import {checkSize, parseGeoJSON, validateFacilities, validateZones} from './validate.mjs';

/** @typedef {import('./geo.mjs').Site} Site */
/** @typedef {import('./geo.mjs').Zone} Zone */
/** @typedef {import('./geo.mjs').Result} Result */
/** @typedef {import('./validate.mjs').Problem} Problem */
/** @typedef {{baseline: Collection<Zone>, expanded: Collection<Zone>|null}} ZoneSet */
/**
 * @template T
 * @typedef {import('./geo.mjs').Collection<T>} Collection
 */
/** @typedef {{layer: 'facilities'|'zones', total: number, accepted: number, rejected: number, problems: Problem[], omittedProblems: number}} LayerReport */
/**
 * @typedef {{type: 'run', facilities: {text: string}|{collection: Collection<Site>}, zones: {text: string}|ZoneSet}} Job
 * `text` is a file the user chose; the other forms are the layer already on screen.
 */
/**
 * @typedef {{type: 'status', message: string}
 *   | {type: 'progress', done: number, total: number}
 *   | {type: 'rejected', reports: LayerReport[]}
 *   | {type: 'result', reports: LayerReport[], sites?: Collection<Site>, zones?: ZoneSet, baseline: Collection<Result>, expanded: Collection<Result>|null, elapsedMs: number}
 *   | {type: 'error', message: string}} WorkerMessage
 */

const count = (/** @type {number} */ n) => n.toLocaleString('en-US');
/** @template T @param {T[]} features @returns {Collection<T>} */
const collection = features => ({type: 'FeatureCollection', features});

/**
 * @template T
 * @param {'facilities'|'zones'} layer
 * @param {string} text
 * @param {(input: any) => import('./validate.mjs').Validation<T>} validate
 * @param {(message: WorkerMessage) => void} post
 * @returns {{report: LayerReport, features: T[]}}
 */
function load(layer, text, validate, post) {
  post({type: 'status', message: 'Checking ' + layer + '…'});
  // text.length is never more than the byte size, so this is a floor; the page checks File.size, the exact size, first.
  const tooBig = checkSize(text.length);
  const parsed = tooBig ? null : parseGeoJSON(text);
  const problem = tooBig ?? (parsed && 'problem' in parsed ? parsed.problem : null);
  if (problem || !parsed || !('value' in parsed))
    return {report: {layer, total: 0, accepted: 0, rejected: 0, problems: problem ? [problem] : [], omittedProblems: 0}, features: []};
  const result = validate(parsed.value);
  return {report: {layer, total: result.total, accepted: result.features.length, rejected: result.rejected,
    problems: result.problems, omittedProblems: result.omittedProblems}, features: result.features};
}

/**
 * @param {Job} job
 * @param {(message: WorkerMessage) => void} post
 */
export function runJob(job, post) {
  const started = performance.now();
  /** @type {LayerReport[]} */ const reports = [];
  let sites = null, zones = null, importedSites = false, importedZones = false;

  if ('text' in job.facilities) {
    const {report, features} = load('facilities', job.facilities.text, validateFacilities, post);
    reports.push(report);
    importedSites = true;
    sites = features.length ? collection(features) : null;
  } else sites = job.facilities.collection;

  if ('text' in job.zones) {
    const {report, features} = load('zones', job.zones.text, validateZones, post);
    reports.push(report);
    importedZones = true;
    zones = features.length ? {baseline: collection(features), expanded: null} : null;
  } else zones = job.zones;

  if (!sites || !zones) { post({type: 'rejected', reports}); return; }

  const passes = zones.expanded ? 2 : 1;
  post({type: 'status', message: 'Analysing ' + count(sites.features.length) + ' facilities against ' + count(zones.baseline.features.length) + ' zones…'});
  const pass = (/** @type {number} */ k) => (/** @type {number} */ done, /** @type {number} */ total) =>
    post({type: 'progress', done: k * total + done, total: passes * total});
  const baseline = analyze(sites, zones.baseline, {onProgress: pass(0)});
  const expanded = zones.expanded ? withChange(baseline, analyze(sites, zones.expanded, {onProgress: pass(1)})) : null;
  post({type: 'result', reports, sites: importedSites ? sites : undefined, zones: importedZones ? zones : undefined,
    baseline, expanded, elapsedMs: performance.now() - started});
}

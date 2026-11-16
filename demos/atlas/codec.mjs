// Text codecs: CSV and GeoJSON export, and the URL hash that carries the view state. No page access.

/** @typedef {import('./geo.mjs').Result} Result */
/** @typedef {'baseline'|'expanded'} Scenario */
/** @typedef {'all'|'high'|'moderate'|'low'|'outside'} LevelFilter */
/** @typedef {{scenario: Scenario, level: LevelFilter, site: string|null}} ViewState */

export const LEVEL_FILTERS = /** @type {const} */ (['all', 'high', 'moderate', 'low', 'outside']);
export const CSV_COLUMNS = ['id', 'name', 'category', 'lon', 'lat', 'exposure', 'baseline_exposure', 'change', 'matched_zones'];
const MAX_SITE_LENGTH = 200;

/**
 * One CSV cell. Text that starts with = + - @ tab or carriage return gets a leading apostrophe, so a spreadsheet shows
 * it as text instead of running it as a formula; numbers are written as they are.
 * @param {string|number|null|undefined} value
 */
export function csvCell(value) {
  if (value === null || value === undefined) return '';
  let text = String(value);
  if (typeof value === 'string' && /^[=+\-@\t\r]/.test(text)) text = "'" + text;
  return /[",\r\n]/.test(text) ? '"' + text.replace(/"/g, '""') + '"' : text;
}

/** @param {Result[]} features one row per facility; lines end in CRLF as RFC 4180 asks */
export function toCsv(features) {
  const rows = features.map(({geometry, properties: p}) => [p.id, p.name, p.category, geometry.coordinates[0], geometry.coordinates[1],
    p.exposure, p.baselineExposure, p.exposureChange, p.matchedZones.join('; ')].map(csvCell).join(','));
  return [CSV_COLUMNS.join(','), ...rows, ''].join('\r\n');
}

/** @param {Result[]} features */
export function toGeoJSON(features) {
  return JSON.stringify({type: 'FeatureCollection', features}, null, 2);
}

/** @param {ViewState} state @returns {string} a hash such as #scenario=expanded&level=high&site=S04, or '' for the defaults */
export function encodeState({scenario, level, site}) {
  const params = new URLSearchParams();
  if (scenario === 'expanded') params.set('scenario', 'expanded');
  if (level !== 'all') params.set('level', level);
  if (site) params.set('site', site);
  const text = params.toString();
  return text ? '#' + text : '';
}

/** @param {string|null} value @returns {value is LevelFilter} */
const isLevelFilter = value => LEVEL_FILTERS.some(level => level === value);

/** Reads a hash written by encodeState. Anything it does not understand falls back to the default. @param {string} hash @returns {ViewState} */
export function decodeState(hash) {
  const params = new URLSearchParams(String(hash).replace(/^#/, ''));
  const level = params.get('level'), site = params.get('site');
  return {
    scenario: params.get('scenario') === 'expanded' ? 'expanded' : 'baseline',
    level: isLevelFilter(level) ? level : 'all',
    site: site && site.length <= MAX_SITE_LENGTH ? site : null
  };
}

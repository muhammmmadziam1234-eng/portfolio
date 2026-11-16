// Validation of imported GeoJSON layers. Nothing here touches the page, so the same code runs in the worker and in tests.
//
// A feature is accepted only when it has no problem at all. Every problem names the feature (its index in the file),
// the field (a path such as geometry.coordinates[0][3][1]) and what was wrong. A file that is not a feature
// collection, or is over a limit, is refused as a whole with one problem whose index is null.

/** @typedef {{index: number|null, field: string, message: string}} Problem */
/**
 * @template T
 * @typedef {{features: T[], problems: Problem[], total: number, rejected: number, omittedProblems: number}} Validation
 */
/** @typedef {import('./geo.mjs').Site} Site */
/** @typedef {import('./geo.mjs').Zone} Zone */

export const LIMITS = Object.freeze({maxBytes: 5 * 1024 * 1024, maxFeatures: 100000, maxProblems: 1000, maxText: 200});
export const ZONE_LEVELS = Object.freeze(['low', 'moderate', 'high']);

const number = (/** @type {number} */ n) => n.toLocaleString('en-US');
const isObject = (/** @type {any} */ v) => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Describe a value for a message, without echoing long text. @param {any} v */
function found(v) {
  if (typeof v === 'string') return JSON.stringify(v.length > 40 ? v.slice(0, 40) + '…' : v);
  if (typeof v === 'number') return String(v);
  if (v === undefined) return 'nothing';
  if (v === null) return 'null';
  return Array.isArray(v) ? 'an array' : typeof v === 'object' ? 'an object' : 'a ' + typeof v;
}

/**
 * @param {number} bytes Size of the file in bytes.
 * @returns {Problem|null}
 */
export function checkSize(bytes) {
  if (bytes <= LIMITS.maxBytes) return null;
  return {index: null, field: '(file)', message: 'The file is ' + (bytes / 1048576).toFixed(1) + ' MB; the limit is ' +
    LIMITS.maxBytes / 1048576 + ' MB. Split it into smaller files.'};
}

/** @param {string} text @returns {{value: any}|{problem: Problem}} */
export function parseGeoJSON(text) {
  try {
    return {value: JSON.parse(text.charCodeAt(0) === 0xFEFF ? text.slice(1) : text)};
  } catch (error) {
    return {problem: {index: null, field: '(file)', message: 'Not valid JSON: ' + (error instanceof Error ? error.message : String(error))}};
  }
}

/** @typedef {(field: string, message: string) => void} Fail */

/**
 * @param {any} value
 * @param {string} field
 * @param {Fail} fail
 * @returns {[number, number]|null} longitude and latitude, or null after reporting why not
 */
function checkPosition(value, field, fail) {
  if (!Array.isArray(value) || value.length < 2 || value.length > 3) {
    fail(field, 'Expected [longitude, latitude] (an altitude is allowed as a third number), found ' + found(value) +
      (Array.isArray(value) ? ' with ' + value.length + (value.length === 1 ? ' element' : ' elements') : '') + '.');
    return null;
  }
  let ok = true;
  value.forEach((v, i) => {
    if (typeof v !== 'number' || !Number.isFinite(v)) { fail(field + '[' + i + ']', 'Expected a finite number, found ' + found(v) + '.'); ok = false; }
  });
  if (!ok) return null;
  const [lon, lat] = value;
  if (lon < -180 || lon > 180) { fail(field + '[0]', 'Longitude ' + lon + ' is outside -180 to 180.'); ok = false; }
  if (lat < -90 || lat > 90) { fail(field + '[1]', 'Latitude ' + lat + ' is outside -90 to 90.'); ok = false; }
  return ok ? [lon, lat] : null;
}

/** @param {any} value @param {string} field @param {Fail} fail @returns {string|null} the trimmed text */
function checkText(value, field, fail) {
  if (typeof value !== 'string') { fail(field, 'Expected a string, found ' + found(value) + '.'); return null; }
  const text = value.trim();
  if (!text) { fail(field, 'Must not be empty.'); return null; }
  if (text.length > LIMITS.maxText) { fail(field, 'Is ' + text.length + ' characters; the limit is ' + LIMITS.maxText + '.'); return null; }
  return text;
}

/** Reports the first problem of a ring only. @param {any} ring @param {string} field @param {string} label @param {Fail} fail */
function checkRing(ring, field, label, fail) {
  if (!Array.isArray(ring)) { fail(field, 'The ' + label + ' must be an array of positions, found ' + found(ring) + '.'); return; }
  if (ring.length < 4) {
    fail(field, 'The ' + label + ' has ' + ring.length + ' position' + (ring.length === 1 ? '' : 's') +
      '; a closed ring needs at least 4 (the first position repeated at the end).');
    return;
  }
  for (let i = 0; i < ring.length; i++) {
    let bad = false;
    checkPosition(ring[i], field + '[' + i + ']', (f, m) => { bad = true; fail(f, m); });
    if (bad) return;
  }
  const first = ring[0], last = ring[ring.length - 1];
  if (first[0] !== last[0] || first[1] !== last[1]) {
    fail(field, 'The ' + label + ' is not closed: the last position [' + last[0] + ', ' + last[1] + '] differs from the first [' + first[0] + ', ' + first[1] + '].');
    return;
  }
  for (let i = 1; i < ring.length; i++) {
    const jump = Math.abs(ring[i][0] - ring[i - 1][0]);
    if (jump > 180) {
      fail(field + '[' + i + ']', 'The edge into this position jumps ' + jump + ' degrees of longitude. Rings that cross the antimeridian ' +
        'are not supported; split the zone at 180 degrees.');
      return;
    }
  }
  let twiceArea = 0;
  for (let i = 1; i < ring.length; i++)
    twiceArea += (ring[i - 1][0] - first[0]) * (ring[i][1] - first[1]) - (ring[i][0] - first[0]) * (ring[i - 1][1] - first[1]);
  if (twiceArea === 0) fail(field, 'The ' + label + ' has zero area (all of its positions are on one line).');
}

/** @param {any} rings @param {string} field @param {Fail} fail */
function checkPolygon(rings, field, fail) {
  if (!Array.isArray(rings) || rings.length === 0) { fail(field, 'A polygon needs at least one ring (the outer boundary), found ' + found(rings) + '.'); return; }
  rings.forEach((ring, r) => checkRing(ring, field + '[' + r + ']', r === 0 ? 'outer ring' : 'hole', fail));
}

/** @param {any} feature @param {Fail} fail @returns {boolean} whether the object has the shape of a feature */
function checkFeatureShell(feature, fail) {
  if (!isObject(feature)) { fail('(feature)', 'Expected a Feature object, found ' + found(feature) + '.'); return false; }
  if (feature.type !== 'Feature') fail('type', 'Expected "Feature", found ' + found(feature.type) + '.');
  return true;
}

/**
 * @template T
 * @param {any} input
 * @param {(feature: any, index: number, fail: Fail, accepted: Map<string, number>) => T|null} checkFeature
 * @returns {Validation<T>}
 */
function validateLayer(input, checkFeature) {
  /** @type {Problem[]} */ const problems = [];
  let omitted = 0;
  const refuse = (/** @type {string} */ field, /** @type {string} */ message, total = 0) => {
    problems.push({index: null, field, message});
    return {features: [], problems, total, rejected: 0, omittedProblems: 0};
  };
  if (!isObject(input)) return refuse('(file)', 'Expected a GeoJSON FeatureCollection object, found ' + found(input) + '.');
  if (input.type !== 'FeatureCollection') return refuse('type', 'Expected "FeatureCollection", found ' + found(input.type) + '.');
  if (!Array.isArray(input.features)) return refuse('features', '"features" must be an array.');
  /** @type {any[]} */
  const list = input.features;
  if (list.length > LIMITS.maxFeatures) {
    return refuse('features', 'The file has ' + number(list.length) + ' features; the limit is ' + number(LIMITS.maxFeatures) +
      '. Split it into smaller files.', list.length);
  }
  /** @type {T[]} */ const accepted = [];
  const ids = new Map();
  list.forEach((feature, index) => {
    const fail = (/** @type {string} */ field, /** @type {string} */ message) => {
      if (problems.length < LIMITS.maxProblems) problems.push({index, field, message}); else omitted++;
    };
    const result = checkFeature(feature, index, fail, ids);
    if (result) accepted.push(result);
  });
  return {features: accepted, problems, total: list.length, rejected: list.length - accepted.length, omittedProblems: omitted};
}

/**
 * Facilities: Point features with a string id (unique), name and category, and a longitude and latitude in range.
 * Only those three properties are kept; an altitude is dropped.
 * @param {any} input a parsed GeoJSON value
 * @returns {Validation<Site>}
 */
export function validateFacilities(input) {
  return validateLayer(input, (feature, index, fail, ids) => {
    let ok = true;
    const bad = (/** @type {string} */ field, /** @type {string} */ message) => { ok = false; fail(field, message); };
    if (!checkFeatureShell(feature, bad)) return null;
    const geometry = feature.geometry;
    /** @type {[number, number]|null} */ let position = null;
    if (!isObject(geometry)) bad('geometry', 'Expected a Point geometry, found ' + found(geometry) + '.');
    else if (geometry.type !== 'Point') bad('geometry.type', 'Expected "Point", found ' + found(geometry.type) + '. Only point facilities are supported.');
    else position = checkPosition(geometry.coordinates, 'geometry.coordinates', bad);
    /** @type {Record<string, string|null>} */ const text = {};
    if (!isObject(feature.properties)) bad('properties', 'Expected an object with id, name and category, found ' + found(feature.properties) + '.');
    else for (const key of ['id', 'name', 'category']) text[key] = checkText(feature.properties[key], 'properties.' + key, bad);
    const id = text.id;
    if (id && ids.has(id)) bad('properties.id', 'Duplicate id ' + JSON.stringify(id) + ' (first used by feature ' + ids.get(id) + ').');
    if (!ok || !position || !id || !text.name || !text.category) return null;
    ids.set(id, index);
    return {type: 'Feature', geometry: {type: 'Point', coordinates: position}, properties: {id, name: text.name, category: text.category}};
  });
}

/**
 * Zones: Polygon or MultiPolygon features with a name and a level (low, moderate or high). Every ring must be closed,
 * have at least 4 positions and a non-zero area, hold finite longitude/latitude in range, and not jump across the
 * antimeridian. Self-intersecting rings are not detected.
 * @param {any} input a parsed GeoJSON value
 * @returns {Validation<Zone>}
 */
export function validateZones(input) {
  return validateLayer(input, (feature, index, fail) => {
    let ok = true;
    const bad = (/** @type {string} */ field, /** @type {string} */ message) => { ok = false; fail(field, message); };
    if (!checkFeatureShell(feature, bad)) return null;
    const geometry = feature.geometry;
    if (!isObject(geometry)) bad('geometry', 'Expected a Polygon or MultiPolygon geometry, found ' + found(geometry) + '.');
    else if (geometry.type === 'Polygon') checkPolygon(geometry.coordinates, 'geometry.coordinates', bad);
    else if (geometry.type === 'MultiPolygon') {
      if (!Array.isArray(geometry.coordinates) || geometry.coordinates.length === 0) bad('geometry.coordinates', 'A MultiPolygon needs at least one polygon.');
      else geometry.coordinates.forEach((/** @type {any} */ polygon, /** @type {number} */ k) => checkPolygon(polygon, 'geometry.coordinates[' + k + ']', bad));
    } else bad('geometry.type', 'Expected "Polygon" or "MultiPolygon", found ' + found(geometry.type) + '.');
    /** @type {string|null} */ let name = null, level = null;
    if (!isObject(feature.properties)) bad('properties', 'Expected an object with name and level, found ' + found(feature.properties) + '.');
    else {
      name = checkText(feature.properties.name, 'properties.name', bad);
      level = feature.properties.level;
      if (!ZONE_LEVELS.includes(level)) { bad('properties.level', 'Must be one of ' + ZONE_LEVELS.join(', ') + ' (found ' + found(level) + ').'); level = null; }
    }
    if (!ok || !name || !level) return null;
    return {type: 'Feature', geometry: {type: geometry.type, coordinates: geometry.coordinates}, properties: {name, level: /** @type {any} */ (level)}};
  });
}

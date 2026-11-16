import {isObject, tidyText, applyCase, sortedObject} from './util.mjs';
import {resolveOptions} from './options.mjs';
import {analyzeGeometry, makeConfig} from './geometry.mjs';
import {createProximity} from './proximity.mjs';
import {makeFinding} from './codes.mjs';
import {VERSION, TOOL_NAME, REPORT_SCHEMA_VERSION} from './version.mjs';

const ID_PATTERN = /^[A-Z0-9][A-Z0-9_-]{0,39}$/;
const bump = (map, key) => map.set(key, (map.get(key) ?? 0) + 1);

function extendBounds(b, coords) {
  if (typeof coords[0] === 'number') {
    b[0] = Math.min(b[0], coords[0]); b[1] = Math.min(b[1], coords[1]);
    b[2] = Math.max(b[2], coords[0]); b[3] = Math.max(b[3], coords[1]);
  } else for (const c of coords) extendBounds(b, c);
}

// Feature-at-a-time engine behind cleanFeatures and the streaming path. push() takes one raw
// feature and returns the cleaned features it produced (none when rejected); finish() builds the
// report. Memory grows only with the id set, the point index and the capped issue lists.
export function createCleaner(rawOptions) {
  const options = resolveOptions(rawOptions);
  const cfg = makeConfig(options);
  const ids = new Map(), proximity = createProximity(options.nearMeters);
  const categories = new Map(), geometries = new Map(), errorCounts = new Map(), warningCounts = new Map();
  const issues = [], warnings = [], bounds = [Infinity, Infinity, -Infinity, -Infinity];
  let input = 0, accepted = 0, output = 0, errorTotal = 0, warningTotal = 0, finished = null;
  const limited = list => options.maxItems === null || list.length < options.maxItems;

  function reject(index, rawId, code, details) {
    errorTotal++; bump(errorCounts, code);
    if (limited(issues)) issues.push({index, id: rawId, ...makeFinding(code, details)});
    return [];
  }
  function warn(index, rawId, code, details) {
    warningTotal++; bump(warningCounts, code);
    if (limited(warnings)) warnings.push({index, id: rawId, ...makeFinding(code, details)});
  }

  function push(raw) {
    if (finished) throw new Error('finish() was already called on this cleaner.');
    const index = input++;
    if (!isObject(raw) || raw.type !== 'Feature' || !isObject(raw.properties)) return reject(index, null, 'invalid_feature', {});
    const p = raw.properties;
    // The feature's own id wins; properties.id is used when that is missing or not text.
    const rawId = [raw.id, p.id].find(v => typeof v === 'string' && v.trim() !== '') ?? null;
    const id = tidyText(rawId).toUpperCase();
    if (!ID_PATTERN.test(id)) return reject(index, rawId, 'invalid_id', {});
    const values = new Map();
    for (const f of options.fields) {
      if (f.name === 'id') continue;
      const value = applyCase(tidyText(p[f.name]), f.case);
      if (!value) return reject(index, rawId, 'missing_property', {property: f.name});
      if (f.oneOf && !f.oneOf.includes(value)) return reject(index, rawId, 'invalid_property_value', {property: f.name, value, allowed: [...f.oneOf]});
      values.set(f.name, value);
    }
    const result = analyzeGeometry(raw.geometry, cfg);
    if (result.error) return reject(index, rawId, result.error.code, result.error.details);
    const exploded = result.exploded === true, featureIds = [id];
    if (exploded) {
      for (let k = 1; k <= result.geometries.length; k++) featureIds.push(id + '-' + k);
      if (featureIds.some(x => !ID_PATTERN.test(x)))
        return reject(index, rawId, 'invalid_id', {reason: 'The id is too long to number the ' + result.geometries.length + ' points of a MultiPoint; use at most ' + (39 - String(result.geometries.length).length) + ' characters.'});
    }
    for (const x of featureIds) if (ids.has(x)) return reject(index, rawId, 'duplicate_id', {keptIndex: ids.get(x), id: x});
    for (const x of featureIds) ids.set(x, index);
    const out = result.geometries.map((geometry, k) => {
      const featureId = exploded ? featureIds[k + 1] : id;
      const properties = {};
      for (const f of options.fields) properties[f.name] = f.name === 'id' ? featureId : values.get(f.name);
      extendBounds(bounds, geometry.coordinates);
      bump(geometries, geometry.type);
      if (options.groupBy !== null) bump(categories, values.get(options.groupBy));
      if (result.sources) proximity.add(featureId, result.sources[k][0], result.sources[k][1]);
      return {type: 'Feature', id: featureId, geometry, properties};
    });
    accepted++; output += out.length;
    if (exploded) warn(index, rawId, 'multipoint_exploded', {count: out.length, ids: out.map(f => f.id)});
    for (const w of result.warnings) warn(index, rawId, w.code, w.details);
    return out;
  }

  function finish() {
    if (finished) return finished;
    const {pairs, total} = proximity.find(options.maxItems);
    finished = {
      schemaVersion: REPORT_SCHEMA_VERSION,
      tool: {name: TOOL_NAME, version: VERSION},
      options: {
        precision: options.precision, nearMeters: options.nearMeters, geometryTypes: [...options.geometryTypes],
        fields: options.fields.map(f => ({name: f.name, case: f.case, ...(f.oneOf ? {oneOf: [...f.oneOf]} : {})})),
        groupBy: options.groupBy, maxItems: options.maxItems
      },
      input, accepted, rejected: input - accepted, output,
      precision: options.precision, nearMeters: options.nearMeters,
      bbox: output ? [...bounds] : null,
      geometries: sortedObject(geometries),
      categories: sortedObject(categories),
      nearby: pairs,
      counts: {errors: sortedObject(errorCounts), warnings: sortedObject(warningCounts), nearby: total},
      truncated: {issues: errorTotal > issues.length, warnings: warningTotal > warnings.length, nearby: total > pairs.length},
      issues, warnings
    };
    return finished;
  }
  // Counts a record that could not even be parsed (an NDJSON line) as one rejected input.
  function rejectRecord(code, details) { return reject(input++, null, code, details); }
  return {options, push, rejectRecord, finish};
}

export function cleanFeatures(input, options) {
  if (!isObject(input) || input.type !== 'FeatureCollection' || !Array.isArray(input.features))
    throw new TypeError('Input must be a GeoJSON FeatureCollection.');
  const cleaner = createCleaner(options), features = [];
  for (const raw of input.features) for (const f of cleaner.push(raw)) features.push(f);
  const report = cleaner.finish();
  return {cleaned: {type: 'FeatureCollection', ...(report.bbox ? {bbox: [...report.bbox]} : {}), features}, report};
}

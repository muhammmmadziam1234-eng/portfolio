import {isObject} from './util.mjs';
import {resolveOptions} from './options.mjs';
import {cleanFeatures} from './cleaner.mjs';
import {parseJson} from './json.mjs';

function describe(value) {
  if (Array.isArray(value)) return 'an array; wrap the features as {"type":"FeatureCollection","features":[...]}';
  if (isObject(value) && value.type === 'Feature') return 'a single Feature; wrap it as {"type":"FeatureCollection","features":[...]}';
  if (isObject(value) && typeof value.type === 'string') return 'type ' + JSON.stringify(value.type.slice(0, 40)) + '; put the data in Features inside {"type":"FeatureCollection","features":[...]}';
  return value === null ? 'null' : 'a ' + typeof value;
}

/**
 * Parses JSON text and cleans it. Returns {cleaned, report}, or {error} when the text is not
 * valid JSON (with line and column) or is not a FeatureCollection. Bad options throw.
 */
export function cleanText(text, options) {
  if (typeof text !== 'string') throw new TypeError('cleanText expects the JSON text as a string.');
  resolveOptions(options);
  const parsed = parseJson(text.charCodeAt(0) === 0xFEFF ? text.slice(1) : text);
  if (parsed.error) return {error: parsed.error};
  const value = parsed.value;
  if (!isObject(value) || value.type !== 'FeatureCollection' || !Array.isArray(value.features))
    return {error: {code: 'not_a_feature_collection', message: 'Input must be a GeoJSON FeatureCollection, but it is ' + describe(value) + '.'}};
  return cleanFeatures(value, options);
}

import {isObject, applyCase} from './util.mjs';

export const GEOMETRY_TYPES = Object.freeze(['Point', 'MultiPoint', 'LineString', 'MultiLineString', 'Polygon', 'MultiPolygon']);
export const DEFAULT_FIELDS = Object.freeze([
  Object.freeze({name: 'name', case: 'keep', oneOf: null}),
  Object.freeze({name: 'category', case: 'lower', oneOf: null})
]);
const KNOWN = ['precision', 'nearMeters', 'geometryTypes', 'fields', 'groupBy', 'maxItems'];
const CASES = ['keep', 'lower', 'upper'];

// "name", "level:lower" or "level:lower=low|moderate|high"; an object {name, case?, oneOf?} also works.
export function parseField(spec) {
  let name, mode, oneOf;
  if (typeof spec === 'string') {
    const m = /^([^:=,|]+)(?::(keep|lower|upper))?(?:=(.+))?$/.exec(spec.trim());
    if (!m) throw new RangeError('Field "' + spec + '" must look like name, name:lower or name:lower=a|b|c.');
    [, name, mode, oneOf] = m;
    oneOf = oneOf === undefined ? null : oneOf.split('|');
  } else if (isObject(spec) && typeof spec.name === 'string' && spec.name.trim()) {
    ({name, case: mode, oneOf = null} = spec);
    if (mode !== undefined && !CASES.includes(mode)) throw new RangeError('Field "' + spec.name + '": case must be keep, lower or upper.');
    if (oneOf !== null && !(Array.isArray(oneOf) && oneOf.length && oneOf.every(v => typeof v === 'string' && v)))
      throw new RangeError('Field "' + spec.name + '": oneOf must be a non-empty list of text values.');
  } else throw new TypeError('Each field must be a string such as "level:lower" or an object with a name.');
  mode = mode ?? 'keep';
  return Object.freeze({name: name.trim(), case: mode, oneOf: oneOf === null ? null : Object.freeze(oneOf.map(v => applyCase(v, mode)))});
}

export function resolveOptions(options) {
  if (options === undefined || options === null) options = {};
  if (!isObject(options)) throw new TypeError('Options must be an object.');
  for (const key of Object.keys(options))
    if (!KNOWN.includes(key)) throw new TypeError('Unknown option "' + key + '". Known options: ' + KNOWN.join(', ') + '.');
  const {precision = 6, nearMeters = 15, geometryTypes = GEOMETRY_TYPES, maxItems = 10000} = options;
  if (!Number.isInteger(precision) || precision < 0 || precision > 8) throw new RangeError('Precision must be an integer from 0 to 8.');
  if (!Number.isFinite(nearMeters) || nearMeters < 0 || nearMeters > 1000) throw new RangeError('Proximity radius must be from 0 to 1000 metres.');
  if (maxItems !== null && !(Number.isInteger(maxItems) && maxItems >= 0)) throw new RangeError('maxItems must be a whole number of 0 or more, or null for no limit.');
  if (!Array.isArray(geometryTypes) || !geometryTypes.length || !geometryTypes.every(t => GEOMETRY_TYPES.includes(t)))
    throw new RangeError('geometryTypes must be a non-empty list of: ' + GEOMETRY_TYPES.join(', ') + '.');
  const fields = (options.fields ?? DEFAULT_FIELDS);
  if (!Array.isArray(fields)) throw new TypeError('fields must be a list.');
  const parsed = fields.map(parseField);
  if (new Set(parsed.map(f => f.name)).size !== parsed.length) throw new RangeError('fields lists the same property twice.');
  let groupBy = options.groupBy;
  if (groupBy === undefined) groupBy = parsed.some(f => f.name === 'category') ? 'category' : null;
  if (groupBy !== null && !parsed.some(f => f.name === groupBy && f.name !== 'id'))
    throw new RangeError('groupBy must be null or the name of one of the fields (other than id).');
  return {precision, nearMeters, geometryTypes: GEOMETRY_TYPES.filter(t => geometryTypes.includes(t)), fields: parsed, groupBy, maxItems};
}

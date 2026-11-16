import {isObject} from './util.mjs';
import {GEOMETRY_TYPES} from './options.mjs';
import {makeFinding} from './codes.mjs';
import {allCollinear, areaSign, findConflicts, pointInRing} from './predicates.mjs';

// Nesting depth of each type's coordinates: a position is depth 0.
const DEPTH = {Point: 0, MultiPoint: 1, LineString: 1, MultiLineString: 2, Polygon: 2, MultiPolygon: 3};
const MAX_PATHS = 20; // locations listed per warning; the count stays complete

export function makeConfig({precision = 6, geometryTypes = GEOMETRY_TYPES} = {}) {
  return {scale: 10 ** precision, allowedList: geometryTypes, allowed: new Set(geometryTypes), round: n => Number(n.toFixed(precision)) || 0};
}

const fail = (code, details = {}) => ({error: {code, details}});

function badPosition(p) {
  if (!Array.isArray(p)) return 'expected an array of numbers';
  if (p.length !== 2 && p.length !== 3) return 'expected 2 or 3 numbers, found ' + p.length;
  return 'a value is not a finite number';
}
// [longitude, latitude] with an optional altitude, which is accepted and dropped.
function checkPosition(p, path) {
  if (!Array.isArray(p) || (p.length !== 2 && p.length !== 3) || !Number.isFinite(p[0]) || !Number.isFinite(p[1]) || (p.length === 3 && !Number.isFinite(p[2])))
    return {code: 'invalid_coordinates', details: {path, problem: badPosition(p)}};
  if (Math.abs(p[0]) > 180) return {code: 'coordinate_out_of_range', details: {path, axis: 'longitude', value: p[0]}};
  if (Math.abs(p[1]) > 90) return {code: 'coordinate_out_of_range', details: {path, axis: 'latitude', value: p[1]}};
  return null;
}
// Walks the whole coordinates structure once, so shape errors come before any geometric rule.
function checkShape(c, depth, path) {
  if (depth === 0) return checkPosition(c, path);
  if (!Array.isArray(c)) return {code: 'invalid_coordinates', details: {path, problem: 'expected an array'}};
  if (c.length === 0) return {code: 'empty_geometry', details: {path}};
  if (depth === 1) {
    for (let i = 0; i < c.length; i++) {
      const bad = checkPosition(c[i], null);
      if (bad) { bad.details.path = [...path, i]; return bad; }
    }
    return null;
  }
  for (let i = 0; i < c.length; i++) {
    const bad = checkShape(c[i], depth - 1, [...path, i]);
    if (bad) return bad;
  }
  return null;
}

// One entry per warning code, with the number of occurrences and where the first ones are.
function collector() {
  const byCode = new Map();
  return {
    add(code, at, count = 1) {
      let entry = byCode.get(code);
      if (!entry) byCode.set(code, entry = {count: 0, at: []});
      entry.count += count;
      if (entry.at.length < MAX_PATHS) entry.at.push(at);
    },
    list: () => [...byCode].map(([code, details]) => ({code, details}))
  };
}

const roundAll = (coords, cfg) => coords.map(c => [cfg.round(c[0]), cfg.round(c[1])]);
// Drops positions equal to the previous one; orig[k] is where kept position k stood in the input.
function dedupe(pts) {
  const kept = [pts[0]], orig = [0];
  for (let i = 1; i < pts.length; i++) {
    const last = kept[kept.length - 1];
    if (pts[i][0] !== last[0] || pts[i][1] !== last[1]) { kept.push(pts[i]); orig.push(i); }
  }
  return {kept, orig};
}
// A segment longer than 180 degrees of longitude almost certainly goes the long way round the antimeridian.
function flagAntimeridian(pts, orig, path, w) {
  for (let i = 0; i + 1 < pts.length; i++)
    if (Math.abs(pts[i + 1][0] - pts[i][0]) > 180) w.add('antimeridian_crossing', [...path, orig[i + 1] - 1]);
}

function cleanLine(coords, path, cfg, w) {
  const {kept, orig} = dedupe(roundAll(coords, cfg));
  if (kept.length < coords.length) w.add('duplicate_positions', path, coords.length - kept.length);
  if (kept.length < 2) return fail('line_too_short', {path, distinct: kept.length});
  flagAntimeridian(kept, orig, path, w);
  return {line: kept};
}

function cleanRing(coords, path, cfg, w) {
  const {kept, orig} = dedupe(roundAll(coords, cfg));
  if (kept.length < coords.length) w.add('duplicate_positions', path, coords.length - kept.length);
  const first = kept[0], last = kept[kept.length - 1];
  if (kept.length >= 2 && (first[0] !== last[0] || first[1] !== last[1])) {
    kept.push([first[0], first[1]]); orig.push(coords.length);
    w.add('ring_not_closed', path);
  }
  if (kept.length < 4) return fail('ring_too_short', {path, positions: kept.length});
  const xs = kept.map(p => Math.round(p[0] * cfg.scale)), ys = kept.map(p => Math.round(p[1] * cfg.scale));
  if (allCollinear(xs, ys)) return fail('ring_zero_area', {path});
  flagAntimeridian(kept, orig, path, w);
  return {pts: kept, orig, xs, ys};
}

// `member` is the index inside a MultiPolygon, or undefined for a plain Polygon.
function cleanPolygon(coords, path, cfg, w, member) {
  const rings = [], at = member === undefined ? {} : {polygon: member};
  for (let r = 0; r < coords.length; r++) {
    const ring = cleanRing(coords[r], [...path, r], cfg, w);
    if (ring.error) return ring;
    rings.push(ring);
  }
  // Segment indices in details refer to the input ring, duplicates and all.
  const segment = (ring, i) => rings[ring].orig[i + 1] - 1;
  const {self, cross} = findConflicts(rings);
  if (self) return fail('self_intersection', {...at, ring: self.ring, segments: [segment(self.ring, self.a), segment(self.other, self.b)]});
  if (cross) return fail('rings_intersect', {...at, rings: [cross.ring, cross.other], segments: [segment(cross.ring, cross.a), segment(cross.other, cross.b)]});
  // No ring touches another, so one position of a hole tells whether the whole hole is inside.
  for (let r = 1; r < rings.length; r++) {
    const x = rings[r].xs[0], y = rings[r].ys[0];
    if (!pointInRing(x, y, rings[0].xs, rings[0].ys)) return fail('invalid_hole', {...at, ring: r, reason: 'outside_exterior'});
    for (let s = 1; s < rings.length; s++)
      if (s !== r && pointInRing(x, y, rings[s].xs, rings[s].ys)) return fail('invalid_hole', {...at, ring: r, reason: 'inside_other_hole'});
  }
  rings.forEach((ring, r) => {
    if (areaSign(ring.xs, ring.ys) !== (r === 0 ? 1 : -1)) { ring.pts.reverse(); w.add('ring_orientation', [...path, r]); }
  });
  return {polygon: rings.map(ring => ring.pts)};
}

// Checks one geometry against the rules and returns either {error} (the first error found) or
// {geometries, warnings} with the cleaned geometry (one Point per member for a MultiPoint, which
// also sets `exploded`) and, for points, `sources` with the original positions. Never modifies g.
export function analyzeGeometry(g, cfg) {
  if (g === null || g === undefined) return fail('null_geometry');
  if (!isObject(g) || typeof g.type !== 'string') return fail('unknown_geometry_type', {type: null});
  if (g.type === 'GeometryCollection') return fail('geometry_collection_unsupported');
  if (!(g.type in DEPTH)) return fail('unknown_geometry_type', {type: g.type.slice(0, 40)});
  if (!cfg.allowed.has(g.type)) return fail('geometry_type_not_allowed', {type: g.type, allowed: cfg.allowedList});
  const bad = checkShape(g.coordinates, DEPTH[g.type], []);
  if (bad) return {error: bad};
  const c = g.coordinates, w = collector(), point = p => ({type: 'Point', coordinates: [cfg.round(p[0]), cfg.round(p[1])]});
  const done = geometry => ({geometries: [geometry], warnings: w.list()});
  switch (g.type) {
    case 'Point': return {geometries: [point(c)], sources: [[c[0], c[1]]], warnings: []};
    case 'MultiPoint': return {geometries: c.map(point), sources: c.map(p => [p[0], p[1]]), exploded: true, warnings: []};
    case 'LineString': {
      const r = cleanLine(c, [], cfg, w);
      return r.error ? r : done({type: 'LineString', coordinates: r.line});
    }
    case 'MultiLineString': {
      const lines = [];
      for (let i = 0; i < c.length; i++) {
        const r = cleanLine(c[i], [i], cfg, w);
        if (r.error) return r;
        lines.push(r.line);
      }
      return done({type: 'MultiLineString', coordinates: lines});
    }
    case 'Polygon': {
      const r = cleanPolygon(c, [], cfg, w);
      return r.error ? r : done({type: 'Polygon', coordinates: r.polygon});
    }
    default: {
      const polygons = [];
      for (let k = 0; k < c.length; k++) {
        const r = cleanPolygon(c[k], [k], cfg, w, k);
        if (r.error) return r;
        polygons.push(r.polygon);
      }
      return done({type: 'MultiPolygon', coordinates: polygons});
    }
  }
}

// Reports what the cleaner would find in one geometry, as it is written (rounded to `precision`
// decimals, default 8). Stops at the first error. `valid` is true when there is no error.
export function validateGeometry(geometry, options) {
  if (options === undefined) options = {};
  if (!isObject(options)) throw new TypeError('Options must be an object.');
  for (const key of Object.keys(options))
    if (key !== 'precision' && key !== 'geometryTypes') throw new TypeError('Unknown option "' + key + '". Known options: precision, geometryTypes.');
  const {precision = 8, geometryTypes = GEOMETRY_TYPES} = options;
  if (!Number.isInteger(precision) || precision < 0 || precision > 8) throw new RangeError('Precision must be an integer from 0 to 8.');
  if (!Array.isArray(geometryTypes) || !geometryTypes.length || !geometryTypes.every(t => GEOMETRY_TYPES.includes(t)))
    throw new RangeError('geometryTypes must be a non-empty list of: ' + GEOMETRY_TYPES.join(', ') + '.');
  const result = analyzeGeometry(geometry, makeConfig({precision, geometryTypes: GEOMETRY_TYPES.filter(t => geometryTypes.includes(t))}));
  if (result.error) return {valid: false, issues: [makeFinding(result.error.code, result.error.details)]};
  return {valid: true, issues: result.warnings.map(x => makeFinding(x.code, x.details))};
}

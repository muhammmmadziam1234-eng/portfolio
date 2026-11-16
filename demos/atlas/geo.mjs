// Planar point-in-polygon spatial join on GeoJSON longitude/latitude.
//
// Rules (the README states the same ones):
//  - x is longitude and y is latitude; the test is planar. There is no geodesic maths and no antimeridian handling.
//  - A point on a polygon boundary (a vertex or any point of an edge, of the outer ring or of a hole) is covered.
//  - A point strictly inside a hole is not covered.
//  - A MultiPolygon covers a point when any one part covers it.
//  - A site's exposure is the highest level among the zones that cover it; every covering zone is listed.
//  - "On an edge" means the cross product with the edge is under 1e-12 in absolute value and the point lies inside
//    the edge's bounding box. That is exact for integer coordinates; for other values it is a tolerance of about
//    1e-12 / edge length degrees.

/** @typedef {number[]} Position Longitude, latitude and optionally an altitude, which is ignored. */
/** @typedef {'low'|'moderate'|'high'} ZoneLevel */
/** @typedef {ZoneLevel|'outside'} Exposure */
/** @typedef {{type: 'Point', coordinates: Position}} PointGeometry */
/** @typedef {{type: 'Polygon', coordinates: Position[][]}} PolygonGeometry */
/** @typedef {{type: 'MultiPolygon', coordinates: Position[][][]}} MultiPolygonGeometry */
/** @typedef {PolygonGeometry|MultiPolygonGeometry} ZoneGeometry */
/** @typedef {{id: string, name: string, category: string}} SiteProperties */
/** @typedef {{name: string, level: ZoneLevel}} ZoneProperties */
/** @typedef {{type: 'Feature', geometry: PointGeometry, properties: SiteProperties}} Site A facility to classify. */
/** @typedef {{type: 'Feature', geometry: ZoneGeometry, properties: ZoneProperties}} Zone An exposure polygon. */
/** @typedef {SiteProperties & {exposure: Exposure, matchedZones: string[], baselineExposure?: Exposure, exposureChange?: number}} ResultProperties */
/** @typedef {{type: 'Feature', geometry: PointGeometry, properties: ResultProperties}} Result A classified facility. */
/**
 * @template T
 * @typedef {{type: 'FeatureCollection', features: T[]}} Collection
 */
/** @typedef {(done: number, total: number) => void} ProgressCallback */

export const severity = {outside: 0, low: 1, moderate: 2, high: 3};

const ZONE_LEVELS = new Set(['low', 'moderate', 'high']);
const MAX_CELLS_PER_ZONE = 4096;

/**
 * @param {Position} point
 * @param {Position[]} ring
 * @returns {'edge'|'inside'|'outside'}
 */
function ringLocation([x, y], ring) {
  if (!Array.isArray(ring) || ring.length < 4) return 'outside';
  let inside = false;
  // Every vertex is visited with its predecessor, so a ring that repeats its first position at the end and one
  // that does not are the same ring (the repeat only adds a zero-length edge).
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [a, b] = ring[j], [c, d] = ring[i];
    if (Math.abs((x - a) * (d - b) - (y - b) * (c - a)) < 1e-12 &&
        x >= Math.min(a, c) && x <= Math.max(a, c) && y >= Math.min(b, d) && y <= Math.max(b, d)) return 'edge';
    if ((b > y) !== (d > y) && x < (c - a) * (y - b) / (d - b) + a) inside = !inside;
  }
  return inside ? 'inside' : 'outside';
}

/**
 * True when the point is covered by the polygon or multipolygon (boundary included, holes excluded).
 * @param {Position} point
 * @param {ZoneGeometry} geometry
 */
export function contains(point, geometry) {
  const polygons = geometry?.type === 'Polygon' ? [geometry.coordinates] :
    geometry?.type === 'MultiPolygon' ? geometry.coordinates : [];
  return polygons.some(([outer, ...holes]) => {
    const loc = ringLocation(point, outer);
    return loc === 'edge' || (loc === 'inside' && !holes.some(hole => ringLocation(point, hole) === 'inside'));
  });
}

/** @param {ZoneGeometry} geometry @returns {number[]} west, south, east, north */
function bounds({type, coordinates}) {
  const rings = type === 'Polygon' ? [coordinates[0]] : coordinates.map(p => p[0]);
  let west = Infinity, south = Infinity, east = -Infinity, north = -Infinity;
  for (const ring of rings) for (const [x, y] of ring ?? []) {
    west = Math.min(west, x); south = Math.min(south, y); east = Math.max(east, x); north = Math.max(north, y);
  }
  return [west, south, east, north];
}

/**
 * Grid lookups select candidates only; the polygon test makes the final decision. A zone whose bounding box is
 * very wide, empty or not made of finite numbers is never gridded: it stays a candidate for every point, so the
 * grid can only ever shortlist more zones than needed, never fewer.
 * @template {{geometry: ZoneGeometry}} T
 * @param {T[]} zones
 * @param {number} [step] Cell size in degrees.
 * @returns {(point: Position) => T[]}
 */
export function zoneIndex(zones, step = .006) {
  if (!Number.isFinite(step) || step <= 0) throw new RangeError('Grid step must be positive.');
  /** @type {Map<string, T[]>} */
  const cells = new Map();
  /** @type {T[]} */
  const broad = [];
  const tile = (/** @type {number} */ n) => Math.floor(n / step);
  for (const zone of zones) {
    const [west, south, east, north] = bounds(zone.geometry).map(tile);
    if (![west, south, east, north].every(Number.isSafeInteger) || (east - west + 1) * (north - south + 1) > MAX_CELLS_PER_ZONE) {
      broad.push(zone); continue;
    }
    for (let x = west; x <= east; x++) for (let y = south; y <= north; y++) {
      const key = x + ':' + y;
      const list = cells.get(key);
      if (list) list.push(zone); else cells.set(key, [zone]);
    }
  }
  return ([x, y]) => [...(cells.get(tile(x) + ':' + tile(y)) ?? []), ...broad];
}

/** @param {Zone[]} zones */
function checkZones(zones) {
  zones.forEach((zone, i) => {
    const {name, level} = zone.properties ?? {};
    if (typeof name !== 'string') throw new TypeError('Zone ' + i + ' has no text name.');
    if (!ZONE_LEVELS.has(level)) throw new RangeError('Zone "' + name + '" has level "' + level + '"; expected low, moderate or high.');
  });
}

/**
 * Classify every site against the zones.
 * @param {Collection<Site>} sites
 * @param {Collection<Zone>} zones
 * @param {{indexed?: boolean, onProgress?: ProgressCallback}} [options] `indexed: false` scans every zone for every site.
 * @returns {Collection<Result>}
 */
export function analyze(sites, zones, {indexed = true, onProgress} = {}) {
  checkZones(zones.features);
  const candidates = indexed ? zoneIndex(zones.features) : () => zones.features;
  const total = sites.features.length, every = Math.max(1, Math.ceil(total / 200));
  /** @type {Result[]} */
  const features = [];
  for (const site of sites.features) {
    const point = site.geometry.coordinates;
    const matches = candidates(point).filter(zone => contains(point, zone.geometry))
      .sort((a, b) => severity[b.properties.level] - severity[a.properties.level] ||
        a.properties.name.localeCompare(b.properties.name, 'en'));
    features.push({...site, properties: {...site.properties, exposure: matches[0]?.properties.level ?? 'outside',
      matchedZones: matches.map(zone => zone.properties.name)}});
    if (onProgress && features.length % every === 0 && features.length < total) onProgress(features.length, total);
  }
  onProgress?.(total, total);
  return {type: 'FeatureCollection', features};
}

/**
 * Classify the sites under two zone sets and report the signed change in severity (alternative minus baseline).
 * @param {Collection<Site>} sites
 * @param {Collection<Zone>} baselineZones
 * @param {Collection<Zone>} alternativeZones
 * @param {{onProgress?: ProgressCallback}} [options] Progress covers both passes.
 * @returns {Collection<Result>}
 */
export function compare(sites, baselineZones, alternativeZones, {onProgress} = {}) {
  const half = (/** @type {number} */ pass) => onProgress &&
    ((/** @type {number} */ done, /** @type {number} */ total) => onProgress(pass * total + done, 2 * total));
  const baseline = analyze(sites, baselineZones, {onProgress: half(0)});
  return withChange(baseline, analyze(sites, alternativeZones, {onProgress: half(1)}));
}

/**
 * Attach the baseline exposure and the signed change in severity (alternative minus baseline) to the alternative results.
 * @param {Collection<Result>} baseline results for the baseline zones
 * @param {Collection<Result>} alternative results for the alternative zones, for the same sites in the same order
 * @returns {Collection<Result>}
 */
export function withChange(baseline, alternative) {
  return {type: 'FeatureCollection', features: alternative.features.map((f, i) => {
    const baselineExposure = baseline.features[i].properties.exposure;
    return {...f, properties: {...f.properties, baselineExposure,
      exposureChange: severity[f.properties.exposure] - severity[baselineExposure]}};
  })};
}

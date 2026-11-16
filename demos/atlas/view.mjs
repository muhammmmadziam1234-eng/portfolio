// Map geometry helpers: fit imported data into the map box and turn GeoJSON rings into SVG path text. No page access.

/** @typedef {import('./geo.mjs').Position} Position */
/** @typedef {import('./geo.mjs').ZoneGeometry} ZoneGeometry */
/** @typedef {(position: Position) => [number, number]} Projection */

const PAD = 0.06, MIN_SPAN = 0.002;

/**
 * Bounding box of facility points and zone outer rings.
 * @param {{geometry: {coordinates: Position}}[]} sites
 * @param {{geometry: ZoneGeometry}[]} zones
 * @returns {[number, number, number, number]|null} west, south, east, north; null when there is nothing
 */
export function extentOf(sites, zones) {
  let west = Infinity, south = Infinity, east = -Infinity, north = -Infinity;
  const add = (/** @type {Position} */ [x, y]) => {
    if (x < west) west = x; if (x > east) east = x;
    if (y < south) south = y; if (y > north) north = y;
  };
  for (const site of sites) add(site.geometry.coordinates);
  for (const zone of zones) {
    const g = zone.geometry, polygons = g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
    for (const polygon of polygons) for (const position of polygon[0]) add(position);
  }
  return west > east ? null : [west, south, east, north];
}

/**
 * A display projection for data that is not on the sample coast: plane longitude scaled by the cosine of the middle
 * latitude, fitted and centred in the map box. It is for drawing only; analysis always uses longitude and latitude.
 * @param {[number, number, number, number]} extent
 * @param {number} width
 * @param {number} height
 * @returns {Projection}
 */
export function fitProjection([west, south, east, north], width, height) {
  const k = Math.cos((south + north) / 2 * Math.PI / 180);
  const realX = (east - west) * k, realY = north - south;
  const scale = Math.min(width * (1 - 2 * PAD) / Math.max(realX, MIN_SPAN), height * (1 - 2 * PAD) / Math.max(realY, MIN_SPAN));
  const offsetX = (width - realX * scale) / 2, offsetY = (height - realY * scale) / 2;
  return ([lon, lat]) => [offsetX + (lon - west) * k * scale, offsetY + (north - lat) * scale];
}

/**
 * SVG path data for a Polygon or MultiPolygon; every ring (holes included) is its own closed subpath, so the
 * path is meant to be filled with fill-rule evenodd.
 * @param {ZoneGeometry} geometry
 * @param {Projection} project
 */
export function geometryPath(geometry, project) {
  const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
  return polygons.flatMap(rings => rings.map(ring => ring.map((position, i) => {
    const [x, y] = project(position);
    return (i ? 'L' : 'M') + x.toFixed(2) + ' ' + y.toFixed(2);
  }).join(' ') + ' Z')).join(' ');
}

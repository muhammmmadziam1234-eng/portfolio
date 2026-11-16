import {compareText} from './util.mjs';

const EARTH_RADIUS = 6371008.8;
const radians = d => d * Math.PI / 180;
export function meters(lonA, latA, lonB, latB) {
  const dLat = radians(latB - latA), dLon = radians(lonB - lonA);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(radians(latA)) * Math.cos(radians(latB)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS * Math.asin(Math.sqrt(Math.min(1, h)));
}

// Collects the original (unrounded) coordinates of accepted points and later finds the pairs
// closer than `radius` metres with a latitude-ordered sweep. Memory: three flat arrays.
export function createProximity(radius) {
  const lons = [], lats = [], ids = [];
  return {
    add(id, lon, lat) { if (radius) { ids.push(id); lons.push(lon); lats.push(lat); } },
    size: () => ids.length,
    find(limit) {
      const pairs = [];
      let total = 0;
      const n = ids.length, order = new Uint32Array(n);
      for (let i = 0; i < n; i++) order[i] = i;
      order.sort((a, b) => lats[a] - lats[b] || compareText(ids[a], ids[b]));
      const maxLatitudeGap = radius / EARTH_RADIUS * 180 / Math.PI;
      for (let i = 0; i < n; i++) {
        const a = order[i];
        for (let j = i + 1; j < n; j++) {
          const b = order[j];
          if (lats[b] - lats[a] > maxLatitudeGap + 1e-12) break;
          const distance = meters(lons[a], lats[a], lons[b], lats[b]);
          if (distance <= radius) {
            total++;
            if (limit === null || pairs.length < limit) pairs.push({ids: [ids[a], ids[b]].sort(), meters: Math.round(distance * 10) / 10});
          }
        }
      }
      pairs.sort((x, y) => compareText(x.ids[0], y.ids[0]) || compareText(x.ids[1], y.ids[1]));
      return {pairs, total};
    }
  };
}

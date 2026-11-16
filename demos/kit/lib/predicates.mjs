// Exact geometric predicates on integer grid coordinates (positions scaled by 10^precision and
// rounded). Orientation uses plain arithmetic when every product is exactly representable, a
// floating-point error bound otherwise, and BigInt only when the bound cannot decide.
const EXACT = 2 ** 53;
const FILTER = 3.3306690738754716e-16; // Shewchuk's error bound for the 2D orientation filter
const sign = v => (v > 0 ? 1 : v < 0 ? -1 : 0); // unlike Math.sign this never returns -0

/** +1 when c is left of the line a->b (counter-clockwise), -1 when right, 0 when collinear. */
export function orient(ax, ay, bx, by, cx, cy) {
  const l = (bx - ax) * (cy - ay), r = (by - ay) * (cx - ax), det = l - r;
  if (Math.abs(l) < EXACT && Math.abs(r) < EXACT) return sign(det);
  const bound = FILTER * (Math.abs(l) + Math.abs(r));
  if (det > bound) return 1;
  if (-det > bound) return -1;
  const d = (BigInt(bx) - BigInt(ax)) * (BigInt(cy) - BigInt(ay)) - (BigInt(by) - BigInt(ay)) * (BigInt(cx) - BigInt(ax));
  return d > 0n ? 1 : d < 0n ? -1 : 0;
}

const inBox = (ax, ay, bx, by, px, py) => px >= Math.min(ax, bx) && px <= Math.max(ax, bx) && py >= Math.min(ay, by) && py <= Math.max(ay, by);

/** True when the closed segments a-b and c-d share at least one point (touching counts). */
export function segmentsIntersect(ax, ay, bx, by, cx, cy, dx, dy) {
  const o1 = orient(ax, ay, bx, by, cx, cy), o2 = orient(ax, ay, bx, by, dx, dy);
  const o3 = orient(cx, cy, dx, dy, ax, ay), o4 = orient(cx, cy, dx, dy, bx, by);
  if (o1 !== o2 && o3 !== o4) return true;
  return (o1 === 0 && inBox(ax, ay, bx, by, cx, cy)) || (o2 === 0 && inBox(ax, ay, bx, by, dx, dy)) ||
    (o3 === 0 && inBox(cx, cy, dx, dy, ax, ay)) || (o4 === 0 && inBox(cx, cy, dx, dy, bx, by));
}

/** For consecutive segments p->q and q->r: true when r lies back along p->q so the segments overlap. */
export function doubleBack(px, py, qx, qy, rx, ry) {
  return orient(px, py, qx, qy, rx, ry) === 0 && Math.sign(qx - px) * Math.sign(rx - qx) + Math.sign(qy - py) * Math.sign(ry - qy) < 0;
}

/** Sign of the signed area of a closed ring (last position equals the first): +1 counter-clockwise. */
export function areaSign(xs, ys) {
  const n = xs.length - 1, x0 = xs[0], y0 = ys[0];
  let sum = 0, magnitude = 0;
  for (let i = 1; i < n; i++) {
    const a = (xs[i] - x0) * (ys[i + 1] - y0), b = (ys[i] - y0) * (xs[i + 1] - x0);
    sum += a - b; magnitude += Math.abs(a) + Math.abs(b);
  }
  if (magnitude < EXACT || Math.abs(sum) > (n + 4) * 2.3e-16 * magnitude) return sign(sum);
  let exact = 0n;
  for (let i = 1; i < n; i++)
    exact += (BigInt(xs[i]) - BigInt(x0)) * (BigInt(ys[i + 1]) - BigInt(y0)) - (BigInt(ys[i]) - BigInt(y0)) * (BigInt(xs[i + 1]) - BigInt(x0));
  return exact > 0n ? 1 : exact < 0n ? -1 : 0;
}

/** Even-odd test for a point that is known not to lie on the ring. */
export function pointInRing(px, py, xs, ys) {
  let inside = false;
  for (let i = 0, n = xs.length - 1; i < n; i++) {
    const ay = ys[i], by = ys[i + 1];
    if ((ay > py) !== (by > py)) {
      const o = orient(xs[i], ay, xs[i + 1], by, px, py);
      if (by > ay ? o > 0 : o < 0) inside = !inside;
    }
  }
  return inside;
}

/** True when every position of the closed ring lies on one straight line. */
export function allCollinear(xs, ys) {
  let k = 1;
  while (k < xs.length && xs[k] === xs[0] && ys[k] === ys[0]) k++;
  if (k >= xs.length) return true;
  for (let i = k + 1; i < xs.length; i++) if (orient(xs[0], ys[0], xs[k], ys[k], xs[i], ys[i]) !== 0) return false;
  return true;
}

/**
 * Finds crossings among the segments of closed rings (all rings of one polygon). Two segments
 * conflict when they share any point, except consecutive segments of one ring, which may share
 * only their common vertex. Returns the lexicographically first conflict of each kind, as
 * {ring, a, other, b} with segment indices into the given rings, or null.
 */
export function findConflicts(rings) {
  const sx1 = [], sy1 = [], sx2 = [], sy2 = [], sring = [], sidx = [], counts = rings.map(r => r.xs.length - 1);
  rings.forEach((r, k) => {
    for (let i = 0; i < counts[k]; i++) { sx1.push(r.xs[i]); sy1.push(r.ys[i]); sx2.push(r.xs[i + 1]); sy2.push(r.ys[i + 1]); sring.push(k); sidx.push(i); }
  });
  const n = sring.length, minX = new Float64Array(n), maxX = new Float64Array(n), minY = new Float64Array(n), maxY = new Float64Array(n);
  for (let s = 0; s < n; s++) {
    minX[s] = Math.min(sx1[s], sx2[s]); maxX[s] = Math.max(sx1[s], sx2[s]);
    minY[s] = Math.min(sy1[s], sy2[s]); maxY[s] = Math.max(sy1[s], sy2[s]);
  }
  const order = Array.from({length: n}, (_, i) => i).sort((a, b) => minX[a] - minX[b] || a - b);
  let self = null, cross = null;
  const before = (p, q) => !q || p[0] < q[0] || (p[0] === q[0] && (p[1] < q[1] || (p[1] === q[1] && (p[2] < q[2] || (p[2] === q[2] && p[3] < q[3])))));
  for (let u = 0; u < n; u++) {
    const a = order[u];
    for (let v = u + 1; v < n && minX[order[v]] <= maxX[a]; v++) {
      const b = order[v];
      if (minY[b] > maxY[a] || maxY[b] < minY[a]) continue;
      let lo = a, hi = b;
      if (sring[lo] > sring[hi] || (sring[lo] === sring[hi] && sidx[lo] > sidx[hi])) [lo, hi] = [hi, lo];
      let hit;
      if (sring[lo] === sring[hi]) {
        const gap = sidx[hi] - sidx[lo], last = counts[sring[lo]] - 1;
        if (gap === 1) hit = doubleBack(sx1[lo], sy1[lo], sx2[lo], sy2[lo], sx2[hi], sy2[hi]);
        else if (gap === last) hit = doubleBack(sx1[hi], sy1[hi], sx2[hi], sy2[hi], sx2[lo], sy2[lo]);
        else hit = segmentsIntersect(sx1[lo], sy1[lo], sx2[lo], sy2[lo], sx1[hi], sy1[hi], sx2[hi], sy2[hi]);
      } else hit = segmentsIntersect(sx1[lo], sy1[lo], sx2[lo], sy2[lo], sx1[hi], sy1[hi], sx2[hi], sy2[hi]);
      if (!hit) continue;
      const found = [sring[lo], sidx[lo], sring[hi], sidx[hi]];
      if (sring[lo] === sring[hi]) { if (before(found, self)) self = found; } else if (before(found, cross)) cross = found;
    }
  }
  const out = f => f && {ring: f[0], a: f[1], other: f[2], b: f[3]};
  return {self: out(self), cross: out(cross)};
}

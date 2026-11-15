// Reads the SAVED KiCad board (not the generator's model) and writes the compact data the PCB viewer draws.
// usage: node scripts/pcb-data.mjs <path to kicad_pcb> <path to bill-of-materials.csv> <output json>
import {readFileSync, writeFileSync} from 'node:fs';

function parse(text) {
  const tokens = text.match(/\(|\)|"(?:[^"\\]|\\.)*"|[^\s()"]+/g);
  const stack = [[]];
  for (const token of tokens) {
    if (token === '(') stack.push([]);
    else if (token === ')') { const node = stack.pop(); stack[stack.length - 1].push(node); }
    else stack[stack.length - 1].push(token.startsWith('"') ? token.slice(1, -1) : token);
  }
  return stack[0][0];
}
const kids = (node, name) => node.filter(c => Array.isArray(c) && c[0] === name);
const kid = (node, name) => kids(node, name)[0];
const num = value => Math.round(Number(value) * 1000) / 1000;
const property = (node, name) => kids(node, 'property').find(p => p[1] === name)?.[2];

const [boardPath, bomPath, outPath] = process.argv.slice(2);
const root = parse(readFileSync(boardPath, 'utf8'));
const nets = [''];
const netIndex = name => { if (!name) return 0; let i = nets.indexOf(name); if (i < 0) { nets.push(name); i = nets.length - 1; } return i; };

const outline = kids(root, 'gr_line').filter(l => kid(l, 'layer')[1] === 'Edge.Cuts').map(l => {
  const [x1, y1] = kid(l, 'start').slice(1).map(num), [x2, y2] = kid(l, 'end').slice(1).map(num);
  return [x1, y1, x2, y2];
});
const xs = outline.flatMap(l => [l[0], l[2]]), ys = outline.flatMap(l => [l[1], l[3]]);
const bounds = [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];

const segments = {};
for (const s of kids(root, 'segment')) {
  const layer = kid(s, 'layer')[1];
  const [x1, y1] = kid(s, 'start').slice(1).map(num), [x2, y2] = kid(s, 'end').slice(1).map(num);
  (segments[layer] ??= []).push([x1, y1, x2, y2, num(kid(s, 'width')[1]), netIndex(kid(s, 'net')?.[1])]);
}
const vias = kids(root, 'via').map(v => {
  const [x, y] = kid(v, 'at').slice(1).map(num);
  return [x, y, num(kid(v, 'size')[1]), num(kid(v, 'drill')[1]), netIndex(kid(v, 'net')?.[1])];
});
const planes = {};
for (const z of kids(root, 'zone')) {
  const layer = kid(z, 'layer')?.[1] ?? kid(z, 'layers')?.[1];
  const polygons = kids(z, 'filled_polygon').map(fp => {
    const pts = kid(fp, 'pts'), ring = [];
    for (const xy of kids(pts, 'xy')) ring.push([num(xy[1]), num(xy[2])]);
    return ring;
  });
  planes[layer] = {net: netIndex(kid(z, 'net')?.[1]), polygons};
}
const pads = [], parts = [];
for (const fp of kids(root, 'footprint')) {
  const ref = property(fp, 'Reference'), name = fp[1].split(':').pop();
  const [fx, fy] = kid(fp, 'at').slice(1).map(num);
  const side = kid(fp, 'layer')[1] === 'F.Cu' ? 'top' : 'bottom';
  parts.push({ref, value: property(fp, 'Value') ?? '', name, x: fx, y: fy, side, mount: name === 'Mount_M3'});
  for (const pad of kids(fp, 'pad')) {
    const [px, py] = kid(pad, 'at').slice(1).map(num), [w, h] = kid(pad, 'size').slice(1).map(num);
    const drill = kid(pad, 'drill');
    pads.push({ref, n: pad[1], type: pad[2], shape: pad[3], x: num(fx + px), y: num(fy + py), w, h,
      drill: drill && drill[1] !== 'oval' ? num(drill[1]) : null, net: netIndex(kid(pad, 'net')?.[1])});
  }
}
const bomLines = readFileSync(bomPath, 'utf8').trim().split(/\r?\n/);
const header = bomLines[0].split(',');
const csvRow = line => { const cells = []; let cell = '', quoted = false; for (const ch of line) { if (ch === '"') quoted = !quoted; else if (ch === ',' && !quoted) { cells.push(cell); cell = ''; } else cell += ch; } cells.push(cell); return cells; };
const bom = bomLines.slice(1).map(line => Object.fromEntries(csvRow(line).map((v, i) => [header[i], v])))
  .map(r => ({ref: r.Reference, value: r.Value, package: r['Package or connector pitch'], maker: r.Manufacturer, part: r['Part number'], note: r.Population}));

writeFileSync(outPath, JSON.stringify({bounds, outline, segments, vias, planes, pads, parts, nets, bom}) + '\n');
const count = Object.values(segments).reduce((n, a) => n + a.length, 0);
console.log(`pcb-view: ${count} tracks, ${vias.length} vias, ${pads.length} pads, ${parts.length} footprints, ${nets.length - 1} nets, ${bom.length} BOM rows, planes on ${Object.keys(planes).join(', ')}`);

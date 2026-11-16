import {h, svg, announce, clamp} from '../util.js';

const COPPER = [
  {id: 'F.Cu', cls: 'l-top', label: 'Top copper'},
  {id: 'In1.Cu', cls: 'l-in1', label: 'Inner 1'},
  {id: 'In2.Cu', cls: 'l-in2', label: 'Inner 2'},
  {id: 'B.Cu', cls: 'l-bot', label: 'Bottom copper'}
];
const prefix = ref => ref.replace(/\d+$/, '');
const number = ref => Number(ref.match(/\d+$/)?.[0] ?? 0);
const byRef = (a, b) => prefix(a).localeCompare(prefix(b)) || number(a) - number(b);
const expandRefs = text => text.split(/\s*,\s*/).flatMap(token => {
  const m = token.match(/^([A-Z]+)(\d+)-\1?(\d+)$/);
  return m ? Array.from({length: Number(m[3]) - Number(m[2]) + 1}, (_, i) => m[1] + (Number(m[2]) + i)) : [token];
});
const plural = (n, one, many = one + 's') => `${n} ${n === 1 ? one : many}`;
const mm = n => `${Math.round(n * 10) / 10} mm`;

/** Join the loose Edge.Cuts lines into one closed outline. */
function chain(lines) {
  const left = lines.map(l => [...l]);
  const first = left.shift();
  const points = [[first[0], first[1]], [first[2], first[3]]];
  while (left.length) {
    const [x, y] = points[points.length - 1];
    const i = left.findIndex(l => (l[0] === x && l[1] === y) || (l[2] === x && l[3] === y));
    if (i < 0) break;
    const [l] = left.splice(i, 1);
    points.push(l[0] === x && l[1] === y ? [l[2], l[3]] : [l[0], l[1]]);
  }
  return points;
}

export default async function pcb(root) {
  const data = await (await fetch('data/pcb-view.json')).json();
  const netName = i => data.nets[i].replace(/^\//, '');
  const partByRef = new Map(data.parts.map(p => [p.ref, p]));
  const bomByRef = new Map();
  for (const row of data.bom) for (const ref of expandRefs(row.ref)) bomByRef.set(ref, row);
  const padsByRef = Map.groupBy(data.pads, p => p.ref);
  const planeOf = Object.fromEntries(Object.entries(data.planes).map(([id, p]) => [id, p.net]));

  const [x0, y0, x1, y1] = data.bounds, margin = 3;
  const full = {x: x0 - margin, y: y0 - margin, w: x1 - x0 + margin * 2, h: y1 - y0 + margin * 2};
  let vb = {...full};

  // ---- drawing
  const board = svg('path', {class: 'board', d: 'M' + chain(data.outline).map(p => p.join(' ')).join('L') + 'Z'});
  const edge = svg('g', {class: 'edge'}, data.outline.map(l => svg('line', {x1: l[0], y1: l[1], x2: l[2], y2: l[3]})));
  const planes = svg('g', {}, COPPER.filter(c => data.planes[c.id]).map(c => svg('path', {
    class: `plane ${c.cls}`, 'data-net': data.planes[c.id].net, 'fill-rule': 'evenodd',
    d: data.planes[c.id].polygons.map(r => 'M' + r.map(p => p.join(' ')).join('L') + 'Z').join('')
  })));
  const tracks = svg('g', {}, [...COPPER].reverse().map(c => svg('g', {class: `${c.cls}`}, (data.segments[c.id] ?? []).flatMap(s => [
    svg('line', {class: `cu trk ${c.cls}`, x1: s[0], y1: s[1], x2: s[2], y2: s[3], 'stroke-width': s[4], 'data-net': s[5]}),
    svg('line', {class: 'hit', x1: s[0], y1: s[1], x2: s[2], y2: s[3], 'stroke-width': Math.max(s[4], 1.1), 'data-net': s[5]})
  ]))));
  const vias = svg('g', {}, data.vias.flatMap(v => [
    svg('circle', {class: 'cu via', cx: v[0], cy: v[1], r: v[2] / 2, 'data-net': v[4]}),
    svg('circle', {class: 'drill', cx: v[0], cy: v[1], r: v[3] / 2}),
    svg('circle', {class: 'hit', cx: v[0], cy: v[1], r: Math.max(v[2] / 2, 0.7), 'data-net': v[4]})
  ]));
  const pads = svg('g', {}, data.pads.flatMap(p => {
    if (p.type === 'np_thru_hole') return [svg('circle', {class: 'mount', cx: p.x, cy: p.y, r: p.w / 2}), svg('circle', {class: 'drill', cx: p.x, cy: p.y, r: (p.drill ?? p.w * 0.6) / 2})];
    const shape = p.shape === 'circle'
      ? svg('circle', {cx: p.x, cy: p.y, r: p.w / 2})
      : svg('rect', {x: p.x - p.w / 2, y: p.y - p.h / 2, width: p.w, height: p.h});
    shape.setAttribute('class', `cu pad ${p.type === 'smd' ? 'l-top smd' : 'thru'}`);
    shape.dataset.net = p.net; shape.dataset.ref = p.ref;
    const hit = svg('circle', {class: 'hit fill', cx: p.x, cy: p.y, r: Math.max(Math.max(p.w, p.h) / 2, 0.7), 'data-net': p.net, 'data-ref': p.ref, 'data-pin': p.n});
    return [shape, ...(p.drill ? [svg('circle', {class: 'drill', cx: p.x, cy: p.y, r: p.drill / 2})] : []), hit];
  }));
  const labels = svg('g', {class: 'labels'}, data.parts.filter(p => !p.mount).map(p => svg('text', {x: p.x, y: p.y + 0.5, 'text-anchor': 'middle'}, p.ref)));
  const focusBox = svg('rect', {class: 'focus-box', rx: 0.6, hidden: ''});
  const svgEl = svg('svg', {viewBox: `${vb.x} ${vb.y} ${vb.w} ${vb.h}`, role: 'img', class: 'board-svg',
    'aria-label': `The Meridian board seen from the top: ${mm(x1 - x0)} by ${mm(y1 - y0)}, four copper layers, ${data.nets.length - 1} nets. Use the lists beside it to pick a net or a part.`},
    board, planes, tracks, vias, pads, edge, labels, focusBox);
  const view = h('div', {class: 'pcb-view', tabindex: '0', role: 'group', 'aria-label': 'Board viewer. Arrow keys move, plus and minus zoom, zero fits the board.'}, svgEl);

  // ---- controls
  const layerBoxes = COPPER.map(c => {
    const box = h('input', {type: 'checkbox', checked: true, 'data-layer': c.cls});
    const plane = data.planes[c.id] ? ` (${netName(data.planes[c.id].net)} plane)` : '';
    return {c, box, label: h('label', {}, box, `${c.label}${plane}`)};
  });
  const netSelect = h('select', {id: 'pcb-net'}, h('option', {value: ''}, 'None'),
    data.nets.map((n, i) => i ? {n: netName(i), i} : null).filter(Boolean).sort((a, b) => a.n.localeCompare(b.n, 'en', {numeric: true})).map(({n, i}) => h('option', {value: String(i)}, n)));
  const partSelect = h('select', {id: 'pcb-part'}, h('option', {value: ''}, 'None'),
    data.parts.map(p => p.ref).sort(byRef).map(ref => h('option', {value: ref}, `${ref}${partByRef.get(ref).value ? `  ${partByRef.get(ref).value}` : ''}`)));
  const info = h('div', {class: 'pcb-info', role: 'status'}, 'Click a track, pad or via, or pick a net or part below.');
  const side = h('div', {class: 'pcb-side'},
    h('fieldset', {}, h('legend', {}, 'Layers'), layerBoxes.map(l => l.label)),
    h('div', {}, h('label', {for: 'pcb-net'}, 'Connection (net)'), netSelect),
    h('div', {}, h('label', {for: 'pcb-part'}, 'Part'), partSelect),
    info);
  const zoomIn = h('button', {class: 'chip', type: 'button'}, 'Zoom in');
  const zoomOut = h('button', {class: 'chip', type: 'button'}, 'Zoom out');
  const fit = h('button', {class: 'chip', type: 'button'}, 'Fit board');
  const clear = h('button', {class: 'chip', type: 'button'}, 'Clear selection');
  const bar = h('div', {class: 'exhibit-bar'}, zoomIn, zoomOut, fit, clear,
    h('span', {class: 'grow caption'}, 'Drag to move. Hold Ctrl and scroll to zoom. Part names appear when you zoom in.'));

  // ---- bill of materials
  const bomButtons = new Map();
  const bomBody = h('tbody', {}, data.bom.map(row => {
    const refs = expandRefs(row.ref).filter(r => partByRef.has(r));
    const button = refs.length ? h('button', {type: 'button', 'aria-pressed': 'false', 'aria-label': `Show ${row.ref} on the board`, onclick: () => selectPart(button.getAttribute('aria-pressed') === 'true' ? '' : refs[0])}, row.ref) : null;
    if (button) for (const r of refs) bomButtons.set(r, button);
    return h('tr', {}, h('th', {scope: 'row'}, button ?? row.ref), h('td', {}, row.value), h('td', {}, row.package), h('td', {}, row.maker), h('td', {}, row.part), h('td', {}, row.note));
  }));
  const bom = h('details', {class: 'bom-wrap'}, h('summary', {}, `Bill of materials, ${data.bom.length} lines`),
    h('div', {class: 'bom', tabindex: '0', role: 'region', 'aria-label': 'Bill of materials'},
      h('table', {}, h('thead', {}, h('tr', {}, ['Reference', 'Value', 'Package', 'Maker', 'Part number', 'Note'].map(t => h('th', {scope: 'col'}, t)))), bomBody)));

  root.append(bar, h('div', {class: 'pcb'}, view, side), bom);

  // ---- selection
  const state = {net: null, part: null};
  const dim = () => svgEl.classList.toggle('sel', state.net !== null || state.part !== null);

  function describeNet(n) {
    let count = 0, length = 0;
    const layers = new Set();
    for (const c of COPPER) for (const s of data.segments[c.id] ?? []) if (s[5] === n) { count++; length += Math.hypot(s[2] - s[0], s[3] - s[1]); layers.add(c.label.toLowerCase()); }
    const viaCount = data.vias.filter(v => v[4] === n).length;
    const netPads = data.pads.filter(p => p.net === n);
    const parts = new Set(netPads.map(p => p.ref));
    const plane = COPPER.find(c => planeOf[c.id] === n);
    const bits = [`${plural(netPads.length, 'pad')} on ${plural(parts.size, 'part')}`];
    if (count) bits.push(`${plural(count, 'track piece')}, ${mm(length)} in total, on ${[...layers].join(' and ')}`);
    if (viaCount) bits.push(plural(viaCount, 'via'));
    if (plane) bits.push(`the ${plane.label.toLowerCase()} plane`);
    return {title: `Net ${netName(n)}`, text: `${bits.join('; ')}.`};
  }

  function netBox(n) {
    const xs = [], ys = [];
    for (const c of COPPER) for (const s of data.segments[c.id] ?? []) if (s[5] === n) { xs.push(s[0], s[2]); ys.push(s[1], s[3]); }
    for (const v of data.vias) if (v[4] === n) { xs.push(v[0]); ys.push(v[1]); }
    for (const p of data.pads) if (p.net === n) { xs.push(p.x); ys.push(p.y); }
    return xs.length ? [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)] : null;
  }

  function selectNet(n, pad = null, {focus = false} = {}) {
    state.net = n; state.part = null;
    for (const el of svgEl.querySelectorAll('[data-net]:not(.hit)')) el.classList.toggle('on', n !== null && Number(el.dataset.net) === n);
    for (const el of svgEl.querySelectorAll('.pad')) el.classList.remove('part-on');
    focusBox.setAttribute('hidden', '');
    netSelect.value = n === null ? '' : String(n); partSelect.value = '';
    bomButtons.forEach(b => b.setAttribute('aria-pressed', 'false'));
    dim();
    if (n === null) { info.replaceChildren('Click a track, pad or via, or pick a net or part below.'); return; }
    const d = describeNet(n);
    if (focus) { const box = netBox(n); if (box) showBox(...box); }
    info.replaceChildren(h('b', {}, d.title), pad ? ` (pad ${pad.ref}.${pad.pin} selected). ` : '. ', d.text);
    announce(`${d.title}. ${d.text}`);
  }

  function selectPart(ref) {
    state.part = ref || null; state.net = null;
    for (const el of svgEl.querySelectorAll('.on')) el.classList.remove('on');
    for (const el of svgEl.querySelectorAll('.pad')) el.classList.toggle('part-on', Boolean(ref) && el.dataset.ref === ref);
    netSelect.value = ''; partSelect.value = ref || '';
    bomButtons.forEach((b, r) => b.setAttribute('aria-pressed', String(Boolean(ref) && r === ref)));
    dim();
    if (!ref) { focusBox.setAttribute('hidden', ''); info.replaceChildren('Click a track, pad or via, or pick a net or part below.'); return; }
    const part = partByRef.get(ref), own = padsByRef.get(ref) ?? [];
    const xs = own.map(p => p.x), ys = own.map(p => p.y), hw = Math.max(...own.map(p => p.w)) / 2, hh = Math.max(...own.map(p => p.h)) / 2;
    const bx = Math.min(...xs) - hw - 0.7, by = Math.min(...ys) - hh - 0.7;
    focusBox.setAttribute('x', bx); focusBox.setAttribute('y', by);
    focusBox.setAttribute('width', Math.max(...xs) + hw + 0.7 - bx); focusBox.setAttribute('height', Math.max(...ys) + hh + 0.7 - by);
    focusBox.removeAttribute('hidden');
    showBox(bx, by, Math.max(...xs) + hw + 0.7, Math.max(...ys) + hh + 0.7);
    const row = bomByRef.get(ref);
    const nets = [...new Set(own.map(p => p.net).filter(Boolean))].map(netName);
    const lines = [part.mount ? 'Mounting hole, M3 screw.' : `${row?.value || part.value || 'Part'}${row?.package ? `, ${row.package}` : ''}.`];
    lines.push(`${plural(own.length, 'pad')}, ${part.side} side${nets.length ? `, on ${plural(nets.length, 'net')}: ${nets.slice(0, 6).join(', ')}${nets.length > 6 ? ' and more' : ''}` : ''}.`);
    if (row?.part) lines.push(`${row.maker} ${row.part}. ${row.note}.`); else if (row?.note) lines.push(`${row.note}.`);
    info.replaceChildren(h('b', {}, ref), ' ', lines.join(' '));
    announce(`${ref}. ${lines.join(' ')}`);
  }

  netSelect.addEventListener('change', () => selectNet(netSelect.value === '' ? null : Number(netSelect.value), null, {focus: true}));
  partSelect.addEventListener('change', () => selectPart(partSelect.value));
  clear.addEventListener('click', () => selectNet(null));
  for (const {box, c} of layerBoxes) box.addEventListener('change', () => svgEl.classList.toggle(`hide-${c.cls}`, !box.checked));

  // ---- zoom, pan and clicks
  const refresh = () => {
    svgEl.setAttribute('viewBox', `${vb.x} ${vb.y} ${vb.w} ${vb.h}`);
    const zoomed = vb.w < full.w * 0.98;
    view.classList.toggle('zoomed', zoomed);
    svgEl.classList.toggle('show-labels', vb.w < full.w / 2.2);
  };
  const keepInside = () => {
    vb.x = clamp(vb.x, full.x - vb.w / 2, full.x + full.w - vb.w / 2);
    vb.y = clamp(vb.y, full.y - vb.h / 2, full.y + full.h - vb.h / 2);
  };
  function zoomAt(factor, cx = vb.x + vb.w / 2, cy = vb.y + vb.h / 2) {
    const w = clamp(vb.w / factor, full.w / 14, full.w), hgt = w * full.h / full.w;
    vb = {x: cx - (cx - vb.x) * (w / vb.w), y: cy - (cy - vb.y) * (hgt / vb.h), w, h: hgt};
    keepInside(); refresh();
  }
  /** Frame a box (in board millimetres) with some room around it; a box that already fills the board resets the view. */
  function showBox(x0, y0, x1, y1) {
    if (x1 - x0 > full.w * 0.6 || y1 - y0 > full.h * 0.6) { vb = {...full}; refresh(); return; }
    const w = clamp(Math.max(x1 - x0 + 10, (y1 - y0 + 10) * full.w / full.h, full.w / 5), 1, full.w), hgt = w * full.h / full.w;
    vb = {x: (x0 + x1) / 2 - w / 2, y: (y0 + y1) / 2 - hgt / 2, w, h: hgt};
    keepInside(); refresh();
  }
  const toBoard = e => { const r = svgEl.getBoundingClientRect(); return [vb.x + (e.clientX - r.left) / r.width * vb.w, vb.y + (e.clientY - r.top) / r.height * vb.h]; };
  zoomIn.addEventListener('click', () => zoomAt(1.6)); zoomOut.addEventListener('click', () => zoomAt(1 / 1.6));
  fit.addEventListener('click', () => { vb = {...full}; refresh(); });
  view.addEventListener('wheel', e => { if (e.ctrlKey || e.metaKey) { e.preventDefault(); zoomAt(e.deltaY < 0 ? 1.2 : 1 / 1.2, ...toBoard(e)); } }, {passive: false});
  view.addEventListener('keydown', e => {
    if (e.target !== view) return;
    const step = vb.w * 0.12, keys = {ArrowLeft: () => { vb.x -= step; }, ArrowRight: () => { vb.x += step; }, ArrowUp: () => { vb.y -= step; }, ArrowDown: () => { vb.y += step; },
      '+': () => zoomAt(1.4), '=': () => zoomAt(1.4), '-': () => zoomAt(1 / 1.4), '0': () => { vb = {...full}; }};
    if (!(e.key in keys)) return;
    e.preventDefault(); keys[e.key](); keepInside(); refresh();
  });
  let press = null, dragged = false;
  view.addEventListener('pointerdown', e => { if (e.button === 0) { press = {x: e.clientX, y: e.clientY, vx: vb.x, vy: vb.y}; dragged = false; } });
  view.addEventListener('pointermove', e => {
    if (!press || !(e.buttons & 1)) return;
    if (!dragged && Math.hypot(e.clientX - press.x, e.clientY - press.y) < 5) return;
    if (!dragged) { dragged = true; view.setPointerCapture(e.pointerId); view.classList.add('drag'); }
    const r = svgEl.getBoundingClientRect();
    vb.x = press.vx - (e.clientX - press.x) / r.width * vb.w; vb.y = press.vy - (e.clientY - press.y) / r.height * vb.h;
    keepInside(); refresh();
  });
  const endPress = () => { press = null; view.classList.remove('drag'); };
  view.addEventListener('pointerup', endPress); view.addEventListener('pointercancel', endPress);
  view.addEventListener('click', e => {
    if (dragged) { dragged = false; return; }
    const hit = e.target.closest('.hit');
    if (!hit) { selectNet(null); return; }
    const net = Number(hit.dataset.net);
    if (!net) { selectNet(null); return; }
    selectNet(net, hit.dataset.ref ? {ref: hit.dataset.ref, pin: hit.dataset.pin} : null);
  });

  refresh();
  return {destroy() {}};
}

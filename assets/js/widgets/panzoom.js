import {h, clamp} from '../util.js';

/**
 * Pan and zoom for drawing sheets. Drag to pan, buttons or the + and - keys to zoom, arrow keys to pan,
 * ctrl or cmd with the wheel to zoom (so ordinary scrolling still scrolls the page).
 * sheets: [{id, label, src, alt}]
 */
export function mountPanZoom(root, {sheets, caption}) {
  const img = h('img', {src: sheets[0].src, alt: sheets[0].alt, draggable: 'false'});
  const view = h('div', {class: 'pan', tabindex: '0', role: 'group', 'aria-label': 'Drawing viewer. Drag to move. Arrow keys move, plus and minus zoom, zero fits the sheet.'}, img);
  const chips = sheets.map((s, i) => h('button', {class: 'chip', type: 'button', 'aria-pressed': String(i === 0), onclick: () => choose(i)}, s.label));
  const status = h('span', {class: 'caption', style: null}, '');
  const zoomIn = h('button', {class: 'chip', type: 'button', 'aria-label': 'Zoom in'}, 'Zoom in');
  const zoomOut = h('button', {class: 'chip', type: 'button', 'aria-label': 'Zoom out'}, 'Zoom out');
  const fit = h('button', {class: 'chip', type: 'button'}, 'Fit sheet');
  root.append(h('div', {class: 'chips', style: null}, chips), view, h('div', {class: 'pan-tools'}, zoomIn, zoomOut, fit, status), caption ? h('p', {class: 'caption'}, caption) : null);

  let k = 1, x = 0, y = 0, fitK = 1;
  const apply = () => { img.style.transform = `translate(${x}px, ${y}px) scale(${k})`; status.textContent = `${Math.round(k / fitK * 100)} percent`; };
  function fitSheet() {
    const w = img.naturalWidth || 1440, hgt = img.naturalHeight || 960;
    fitK = Math.min(view.clientWidth / w, view.clientHeight / hgt);
    k = fitK; x = (view.clientWidth - w * k) / 2; y = (view.clientHeight - hgt * k) / 2; apply();
  }
  function zoomAt(factor, cx = view.clientWidth / 2, cy = view.clientHeight / 2) {
    const next = clamp(k * factor, fitK * 0.8, fitK * 8);
    x = cx - (cx - x) * (next / k); y = cy - (cy - y) * (next / k); k = next; apply();
  }
  function choose(i) {
    chips.forEach((c, j) => c.setAttribute('aria-pressed', String(i === j)));
    img.src = sheets[i].src; img.alt = sheets[i].alt;
    if (img.complete) fitSheet(); else img.addEventListener('load', fitSheet, {once: true});
  }
  img.addEventListener('load', fitSheet);
  zoomIn.addEventListener('click', () => zoomAt(1.4)); zoomOut.addEventListener('click', () => zoomAt(1 / 1.4)); fit.addEventListener('click', fitSheet);
  let drag = null;
  view.addEventListener('pointerdown', e => { drag = {px: e.clientX, py: e.clientY, x, y}; view.classList.add('drag'); view.setPointerCapture(e.pointerId); });
  view.addEventListener('pointermove', e => { if (drag) { x = drag.x + e.clientX - drag.px; y = drag.y + e.clientY - drag.py; apply(); } });
  const end = () => { drag = null; view.classList.remove('drag'); };
  view.addEventListener('pointerup', end); view.addEventListener('pointercancel', end);
  view.addEventListener('wheel', e => { if (!(e.ctrlKey || e.metaKey)) return; e.preventDefault(); const r = view.getBoundingClientRect(); zoomAt(e.deltaY < 0 ? 1.15 : 1 / 1.15, e.clientX - r.left, e.clientY - r.top); }, {passive: false});
  view.addEventListener('keydown', e => {
    const move = 60, keys = {ArrowLeft: () => { x += move; }, ArrowRight: () => { x -= move; }, ArrowUp: () => { y += move; }, ArrowDown: () => { y -= move; },
      '+': () => zoomAt(1.25), '=': () => zoomAt(1.25), '-': () => zoomAt(1 / 1.25), '0': fitSheet};
    if (!(e.key in keys)) return;
    e.preventDefault(); keys[e.key](); apply();
  });
  new ResizeObserver(() => { if (view.clientWidth) fitSheet(); }).observe(view);
  return {fit: fitSheet, destroy() {}};
}

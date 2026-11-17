import {h, clamp, reducedMotion} from '../util.js';

const ease = t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

/**
 * An image sequence you can scrub with a slider, by dragging the picture, or by playing it.
 * frames: [{src, at, alt}] with `at` from 0 to 1. Returns {set, get, destroy}.
 */
export function mountScrubber(root, {frames, ratio = '1120 / 712', label, endLabels = ['Start', 'End'], valueText = p => `${Math.round(p * 100)} percent`,
  intro = false, caption = '', onChange = null, initial = 0}) {
  const img = h('img', {src: frames[0].src, alt: frames[0].alt ?? '', draggable: 'false', decoding: 'async', fetchpriority: 'high'});
  const frame = h('div', {class: 'scrub-frame'}, img);
  frame.style.setProperty('--ratio', ratio);
  const range = h('input', {type: 'range', min: '0', max: '1000', step: '1', value: '0', 'aria-label': label});
  const play = h('button', {class: 'btn secondary small', type: 'button', 'aria-pressed': 'false'}, 'Play');
  root.append(frame, h('div', {class: 'scrub-controls'}, play, range),
    h('div', {class: 'scrub-ends', 'aria-hidden': 'true'}, h('span', {}, endLabels[0]), h('span', {}, endLabels[1])),
    caption ? h('p', {class: 'caption'}, caption) : null);
  // The first picture loads with the page. The rest load once the page is idle, or at the first touch, whichever comes first.
  // The intro waits for the same moment, so its pictures never compete with the first one while the page is loading.
  // "Loaded" is not enough: a picture that arrived but was never decoded is decoded at the moment it is first shown, and on the
  // first run that happens about sixty times a second in the middle of the intro (the lag and the soft, late pictures).
  // So each one is decoded here, and kept in `warm` so the browser does not throw the decoded pixels away before they are shown.
  let loading = null;
  const warm = [];
  const warmUp = src => new Promise(done => {
    const pre = new Image(); pre.decoding = 'async'; pre.src = src; warm.push(pre);
    if (pre.decode) pre.decode().then(done, done); else { pre.onload = pre.onerror = done; }
  });
  const loadAll = () => loading ??= Promise.all(frames.map(f => warmUp(f.src)));
  const pageReady = new Promise(done => { const go = () => setTimeout(done, 300); if (document.readyState === 'complete') go(); else addEventListener('load', go, {once: true}); });
  pageReady.then(loadAll);

  let p = 0, shown = 0, raf = 0, dir = 1, last = 0, playing = false, interacted = false, destroyed = false;
  const nearest = q => frames.reduce((best, f, i) => Math.abs(f.at - q) < Math.abs(frames[best].at - q) ? i : best, 0);
  function set(q) {
    p = clamp(q, 0, 1);
    const i = nearest(p);
    if (i !== shown) { shown = i; img.src = frames[i].src; img.alt = frames[i].alt ?? ''; }
    range.value = String(Math.round(p * 1000));
    range.setAttribute('aria-valuetext', valueText(p, frames[i], i));
    onChange?.(p, frames[i], i);
  }
  const halt = () => { cancelAnimationFrame(raf); raf = 0; playing = false; play.setAttribute('aria-pressed', 'false'); play.textContent = 'Play'; };
  const touch = () => { interacted = true; halt(); loadAll(); };

  range.addEventListener('input', () => { touch(); set(Number(range.value) / 1000); });
  let drag = null;
  frame.addEventListener('pointerdown', e => { touch(); drag = {x: e.clientX, p}; frame.setPointerCapture(e.pointerId); });
  frame.addEventListener('pointermove', e => { if (drag) set(drag.p + (e.clientX - drag.x) / frame.clientWidth * 1.3); });
  const release = () => { drag = null; };
  frame.addEventListener('pointerup', release); frame.addEventListener('pointercancel', release);

  function tick(now) {
    if (!playing) return;
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    let next = p + dir * dt * 0.28;
    if (next >= 1) { next = 1; dir = -1; } else if (next <= 0) { next = 0; dir = 1; }
    set(next);
    raf = requestAnimationFrame(tick);
  }
  play.addEventListener('click', () => {
    if (playing) { halt(); return; }
    interacted = true; playing = true; last = performance.now(); dir = p >= 1 ? -1 : 1;
    play.setAttribute('aria-pressed', 'true'); play.textContent = 'Pause';
    raf = requestAnimationFrame(tick);
  });
  if (reducedMotion()) { play.disabled = true; play.title = 'Motion is switched off in your system settings. Use the slider.'; }

  let observer = null;
  if (intro && !reducedMotion() && 'IntersectionObserver' in window) {
    observer = new IntersectionObserver(entries => {
      if (!entries.some(e => e.isIntersecting) || interacted) return;
      observer.disconnect();
      pageReady.then(loadAll).then(runIntro);
    }, {threshold: 0.5});
    observer.observe(frame);
  }
  function runIntro() {
    if (interacted || destroyed) return;
    const start = performance.now(), length = 3800;
    const step = now => {
      if (interacted || destroyed) return;
      const t = Math.min(1, (now - start) / length);
      set(t < 0.45 ? ease(t / 0.45) : t < 0.55 ? 1 : 1 - ease((t - 0.55) / 0.45));
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
  }
  set(initial);
  return {set, get: () => p, destroy() { destroyed = true; halt(); observer?.disconnect(); warm.length = 0; }};
}

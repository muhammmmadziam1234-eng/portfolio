import {h, clamp, reducedMotion} from '../util.js';

const ease = t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

/**
 * An image sequence you can scrub with a slider, by dragging the picture, or by playing it.
 * frames: [{src, hi, dense, at, alt}] with `at` from 0 to 1. Returns {set, get, destroy}.
 *
 * Two layers. While the picture MOVES, a canvas draws the sequence at an eased position and blends the two nearest pictures, so dragging,
 * playing and the intro glide instead of stepping. Those pictures (`src`) are decoded once, up front, into ImageBitmaps, so the canvas never
 * decodes anything while it moves, and the <img> is not touched per frame. If the frame rate drops while moving, the canvas steps down
 * (cheaper smoothing, no blending, fewer pixels) and stays down for that visit. When motion stops the canvas settles onto a real picture and
 * the <img> takes over: the browser scales an <img> with a better filter than a canvas gets. A picture at rest is therefore always a real
 * render at full quality, never a blend, whatever level the canvas is on.
 * On a screen that needs it (the picture is more than 900 device pixels across: a retina laptop, any phone at 3x) the <img> shows the large
 * version (`hi`), fetched on demand, so only one large picture is ever held. Below that the standard picture is the sharper one (shrinking
 * 1680 pixels to 660 loses more than shrinking 1120 does; measured), and the large ones are never downloaded.
 * `dense` pictures are extra in-between renders for smoother motion; they cost memory (everything above is held), so only a desktop-class
 * device with room to spare loads them.
 * The <img> is also the fallback and the source of truth (its src and alt follow the slider): it is all a visitor sees with reduced
 * motion, without canvas, or before every picture has loaded.
 */
export function mountScrubber(root, {frames, ratio = '1120 / 712', label, endLabels = ['Start', 'End'], valueText = p => `${Math.round(p * 100)} percent`,
  intro = false, caption = '', onChange = null, initial = 0}) {
  const roomy = matchMedia('(hover: hover) and (pointer: fine)').matches && (navigator.deviceMemory ?? 8) >= 4;
  frames = frames.filter(f => !f.dense || roomy);
  const img = h('img', {src: frames[0].src, alt: frames[0].alt ?? '', draggable: 'false', decoding: 'async', fetchpriority: 'high'});
  const canvas = h('canvas', {class: 'scrub-canvas', 'aria-hidden': 'true'});
  const frame = h('div', {class: 'scrub-frame'}, img, canvas);
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
  // Decoding the <img> does not help the canvas: the first time a canvas draws a picture it decodes it again, on the main thread,
  // about 4 ms each (seen in a trace). With 79 pictures the fastest stretch of the intro meets over two new ones every frame, which
  // costs more than the 16.7 ms a frame has, and a slower device drops most of its frames. So each picture is turned into an
  // ImageBitmap here: decoded pixels we own, which the canvas draws with no decoding at all. (Without ImageBitmap the decoded <img>
  // is kept instead.)
  let loading = null;
  const warm = [], pics = [];
  const warmUp = (src, i) => new Promise(done => {
    const pre = new Image(); pre.decoding = 'async'; pre.src = src;
    const keep = () => { warm.push(pre); pics[i] = pre; done(); };
    const bitmap = () => (window.createImageBitmap ? createImageBitmap(pre).then(b => { pics[i] = b; done(); }, keep) : keep());
    if (pre.decode) pre.decode().then(bitmap, done); else { pre.onload = bitmap; pre.onerror = done; }
  });
  const loadAll = () => loading ??= Promise.all(frames.map((f, i) => warmUp(f.src, i))).then(startSmooth);
  const pageReady = new Promise(done => { const go = () => setTimeout(done, 300); if (document.readyState === 'complete') go(); else addEventListener('load', go, {once: true}); });
  pageReady.then(loadAll);

  let p = 0, shown = 0, raf = 0, dir = 1, last = 0, playing = false, interacted = false, destroyed = false;
  let moved = 0, kick = () => {}, lastText = null; // when the position last changed; wakes the smooth layer
  const nearest = q => frames.reduce((best, f, i) => Math.abs(f.at - q) < Math.abs(frames[best].at - q) ? i : best, 0);
  // With the smooth layer running the <img> is set when motion stops (rest), not on every picture the slider passes.
  // Without it (reduced motion, or before the pictures are decoded) the <img> alone is shown, and still gets the large picture on a screen
  // that needs it once the slider has been still for a moment: how clear the picture is does not depend on the motion setting.
  let upTimer = 0;
  const upgrade = () => { if (smooth || destroyed) return; const hi = wantsHi(), f = frames[shown]; if (hi && f.hi) showFull(f, hi, epoch).catch(() => {}); };
  const show = i => { img.src = frames[i].src; img.alt = frames[i].alt ?? ''; clearTimeout(upTimer); upTimer = setTimeout(upgrade, 160); };
  pageReady.then(() => setTimeout(upgrade, 0)); // the first picture too
  function set(q) {
    p = clamp(q, 0, 1);
    const i = nearest(p);
    if (i !== shown) { shown = i; if (!smooth) show(i); }
    range.value = String(Math.round(p * 1000));
    const text = valueText(p, frames[i], i);
    if (text !== lastText) { range.setAttribute('aria-valuetext', text); lastText = text; }
    moved = performance.now(); kick();
    onChange?.(p, frames[i], i);
  }
  const halt = () => { cancelAnimationFrame(raf); raf = 0; playing = false; play.setAttribute('aria-pressed', 'false'); play.textContent = 'Play'; };
  const touch = () => { interacted = true; halt(); loadAll(); };

  range.addEventListener('input', () => { touch(); set(Number(range.value) / 1000); });
  let drag = null;
  frame.addEventListener('pointerdown', e => { touch(); drag = {x: e.clientX, p, trail: [[performance.now(), p]]}; frame.setPointerCapture(e.pointerId); });
  frame.addEventListener('pointermove', e => {
    if (!drag) return;
    set(drag.p + (e.clientX - drag.x) / frame.clientWidth * 1.3);
    const now = performance.now(); drag.trail.push([now, p]);
    while (drag.trail.length > 2 && now - drag.trail[0][0] > 90) drag.trail.shift();
  });
  // A flick carries on after the finger lifts and slows to a stop (picture units a second, falling by about half every 0.1 s).
  function glide(v) {
    let t0 = performance.now();
    const go = now => {
      if (destroyed) return;
      const dt = Math.min(0.05, (now - t0) / 1000); t0 = now;
      v *= Math.exp(-dt * 6.5);
      const next = clamp(p + v * dt, 0, 1);
      set(next);
      if (Math.abs(v) < 0.02 || next <= 0 || next >= 1) { raf = 0; return; }
      raf = requestAnimationFrame(go);
    };
    raf = requestAnimationFrame(go);
  }
  const release = () => {
    const d = drag; drag = null;
    if (!d || reducedMotion() || d.trail.length < 2) return;
    const [t1, p1] = d.trail[0], [t2, p2] = d.trail[d.trail.length - 1];
    const v = t2 > t1 ? (p2 - p1) / ((t2 - t1) / 1000) : 0;
    if (Math.abs(v) > 0.12 && performance.now() - t2 < 80) glide(Math.max(-1.8, Math.min(1.8, v)));
  };
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

  // ---- The smooth layer ----
  // `pos` is the position being drawn; it chases `p` on a critically damped spring (no overshoot, about a quarter of a second to arrive).
  // While the position is changing it blends the two pictures either side of it. Once nothing has moved for a moment it chases the nearest
  // picture it can rest on (restOf), so it comes to rest on a true render with no ghost of its neighbour.
  let pos = 0, vel = 0, smooth = false, live = false, epoch = 0, sraf = 0, lastDraw = 0, box = null, resizer = null;
  // How hard the canvas works while the picture moves. It starts at the best level and, if frames keep running slow (a weak GPU, a busy
  // phone), steps down: cheaper smoothing, then no blending of neighbours, then fewer pixels. It never steps back up in the same visit.
  // At rest the <img> is what is seen, so none of this touches the still picture, only how the movement between pictures is drawn.
  const LEVELS = [{q: 'medium', blend: true, px: 1}, {q: 'low', blend: true, px: 1}, {q: 'low', blend: false, px: 1}, {q: 'low', blend: false, px: 0.7}, {q: 'low', blend: false, px: 0.5}];
  let lvl = 0, liveFrames = 0, winFrames = 0, winSlow = 0;
  const ctx = canvas.getContext?.('2d', {alpha: false});
  // Whether the <img> should show the large picture now (see the header), and the picture to come to rest on: the nearest one that can be
  // shown at full quality (only those with a large version, when the large version is wanted).
  const wantsHi = () => frames.some(f => f.hi) && img.clientWidth * (window.devicePixelRatio || 1) > 900;
  const restOf = (q, hi) => {
    let best = -1;
    for (let i = 0; i < frames.length; i++) if (!(hi && !frames[i].hi) && (best < 0 || Math.abs(frames[i].at - q) < Math.abs(frames[best].at - q))) best = i;
    return best;
  };
  // The canvas gets exactly the device pixels the <img> would: no cap at 2x (a phone at 3x was drawn small and stretched, half as sharp),
  // and the same snapped edges the browser uses for the picture, so nothing is resampled on its way to the screen.
  // Only a very large screen is held back, to bound memory (about 16 million pixels is far more than the pictures can fill).
  const fit = () => {
    if (!img.clientWidth) return false;
    const r = img.getBoundingClientRect(), f = frame.getBoundingClientRect();
    let dpr = window.devicePixelRatio || 1;
    dpr = Math.min(dpr, Math.sqrt(16e6 / Math.max(1, r.width * r.height))) * LEVELS[lvl].px;
    const w = Math.max(1, Math.round(r.right * dpr) - Math.round(r.left * dpr)), hgt = Math.max(1, Math.round(r.bottom * dpr) - Math.round(r.top * dpr));
    Object.assign(canvas.style, {left: r.left - f.left + 'px', top: r.top - f.top + 'px', width: r.width + 'px', height: r.height + 'px'});
    if (canvas.width !== w || canvas.height !== hgt) { canvas.width = w; canvas.height = hgt; ctx.fillStyle = '#232c33'; ctx.fillRect(0, 0, w, hgt); }
    box = {w, h: hgt};
    return true;
  };
  function draw() {
    if (!box && !fit()) return false;
    const lo = Math.max(0, Math.min(frames.length - 2, frames.findLastIndex(f => f.at <= pos)));
    const a = frames[lo], b = frames[Math.min(lo + 1, frames.length - 1)];
    const k = b.at > a.at ? clamp((pos - a.at) / (b.at - a.at), 0, 1) : 0;
    const base = pics[lo], over = pics[Math.min(lo + 1, frames.length - 1)];
    const iw = base.naturalWidth || base.width, ih = base.naturalHeight || base.height, sc = Math.min(box.w / iw, box.h / ih);
    const dw = Math.round(iw * sc), dh = Math.round(ih * sc), dx = Math.round((box.w - dw) / 2), dy = Math.round((box.h - dh) / 2);
    // 'medium' (mipmapped) costs about a third as much again as 'low' for an ImageBitmap, and 'high' about three times; while the picture
    // moves nobody sees the difference, and the sharp version is the <img> at rest. The background is filled once, when the canvas is
    // sized (fit), not every frame.
    const L = LEVELS[lvl], single = !L.blend || k < 0.005 || k > 0.995;
    ctx.imageSmoothingQuality = L.q;
    ctx.drawImage(single && k >= 0.5 ? over : base, dx, dy, dw, dh);
    if (!single) { ctx.globalAlpha = k; ctx.drawImage(over, dx, dy, dw, dh); ctx.globalAlpha = 1; }
    return true;
  }
  // While the picture moves the canvas is on top (class `live`); at rest it fades out and the <img> underneath, showing the large
  // version of the same render, is what is seen. The fade hides the small change in sharpness.
  const goLive = () => { if (live || !draw()) return; live = true; liveFrames = winFrames = winSlow = 0; frame.classList.add('live'); };
  async function showFull(f, hi, mine) {
    const big = hi && f.hi, want = big ? f.hi : f.src;
    if (img.getAttribute('src') !== want) img.src = want;
    try { await img.decode(); } catch (e) {
      if (mine !== epoch || img.getAttribute('src') !== want || !big) throw e; // superseded, or nothing better to fall back to
      f.hi = null; img.src = f.src; await img.decode(); // the large picture would not load: use the standard one
    }
  }
  async function rest() {
    const mine = epoch, hi = wantsHi(), f = frames[restOf(p, hi)];
    draw();
    try { img.alt = f.alt ?? ''; await showFull(f, hi, mine); } catch (_) { return; } // on failure the canvas simply stays
    if (mine === epoch && live) { live = false; frame.classList.remove('live'); }
  }
  function smoothStep(now) {
    sraf = 0;
    if (destroyed) return;
    const gap = lastDraw ? now - lastDraw : 0;
    const dt = Math.min(0.05, Math.max(0.001, (now - (lastDraw || now - 16)) / 1000)); lastDraw = now;
    // Judge the frame rate over windows of 12 frames of movement (skipping the first few): four slow ones (over 24 ms) step down one level,
    // nine or more (most of them) step down two, so a weak device settles within the first second or so of the first movement.
    if (live && gap > 0 && gap < 250 && ++liveFrames > 4) {
      winFrames++; if (gap > 24) winSlow++;
      if (winFrames === 12) { if (winSlow >= 4) { lvl = Math.min(LEVELS.length - 1, lvl + (winSlow >= 9 ? 2 : 1)); box = null; } winFrames = winSlow = 0; }
    }
    const idle = now - moved > 110 && !playing && !drag;
    const goal = idle ? frames[restOf(p, wantsHi())].at : p;
    const w = 17, x = w * dt, ex = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x), change = pos - goal, temp = (vel + w * change) * dt;
    vel = (vel - w * temp) * ex; pos = goal + (change + temp) * ex;
    if (Math.abs(pos - goal) < 0.0004 && Math.abs(vel) < 0.004 && idle) { pos = goal; vel = 0; lastDraw = 0; rest(); return; }
    if (!live && Math.abs(pos - goal) > 0.0004) goLive();
    draw();
    sraf = requestAnimationFrame(smoothStep);
  }
  function startSmooth() {
    if (smooth || destroyed || !ctx || reducedMotion() || !frames.every((_, i) => pics[i])) return;
    smooth = true; pos = p; vel = 0;
    kick = () => { epoch++; if (!sraf) sraf = requestAnimationFrame(smoothStep); };
    // The canvas is shown only after it has drawn (goLive), so a scrubber inside a hidden tab never shows a blank picture.
    resizer = new ResizeObserver(() => { box = null; draw(); });
    resizer.observe(frame);
    draw(); frame.classList.add('smooth');
    kick();
  }
  set(initial);
  return {set, get: () => p, destroy() { destroyed = true; halt(); clearTimeout(upTimer); cancelAnimationFrame(sraf); resizer?.disconnect(); observer?.disconnect(); warm.length = 0; for (const b of pics) b?.close?.(); pics.length = 0; }};
}

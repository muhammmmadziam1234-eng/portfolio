#!/usr/bin/env node
// Writes the project card pictures (assets/img/cards/<slug>.webp, 960 by 720) and the PNG icons.
// Run it by hand when a source picture changes, then commit the output; the site never runs it.
// Renders come from the project checkouts next to this one; app pictures are screenshots of the demos on this site.
//
// usage: node scripts/cards.mjs [--repos <folder holding the project checkouts>] [--only atlas,kit]
//   CHROME_PATH picks the browser, as for the tests.
import {mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {dirname, extname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright-core';
import {serve} from './serve.mjs';

const site = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const option = (name, fallback) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : fallback; };
const reposDir = resolve(option('repos', resolve(site, '..')));
const only = (option('only', '') || '').split(',').filter(Boolean);
const W = 960, H = 720;

/* What each card shows. `focus` is where a 4:3 crop is centred, as fractions of the source picture. */
const cards = {
  atlas: {shot: 'demos/atlas/index.html', element: '#map'},
  kit: {shot: 'index.html#/p/kit', element: '.play > section:nth-of-type(2)', clip: {x: 0, y: 0, width: 600, height: 450}, prepare: async page => {
    await page.getByRole('button', {name: 'Clean', exact: true}).click();
    await page.waitForFunction(() => document.querySelector('.play .tally dd'));
  }},
  tracker: {file: join(site, 'assets/media/tracker/poster.jpg'), crop: {x: 500, y: 0, width: 780, height: 585}},
  paint: {shot: 'demos/paint/index.html', element: 'main', clip: {x: 58, y: 0, width: 1144, height: 858}},
  pcb: {file: join(reposDir, 'industrial-sensor-carrier-pcb/media/meridian-board-render.png'), focus: [0.5, 0.5]},
  sensor: {file: join(reposDir, 'cirrus-environment-sensor/renders/hero.png'), focus: [0.5, 0.5]},
  lamp: {file: join(reposDir, 'formline-articulated-lamp/renders/hero.png'), focus: [0.5, 0.5]},
  ads: {pair: [join(reposDir, 'cirrus-formline-ad-campaigns/exports/cirrus-vertical.png'), join(reposDir, 'cirrus-formline-ad-campaigns/exports/formline-vertical.png')]}
};

const dataUrl = file => `data:image/${extname(file) === '.png' ? 'png' : 'jpeg'};base64,${readFileSync(file).toString('base64')}`;

/** Draw in the browser and return WebP bytes. `sources` are image URLs; `plan` runs in the page with them decoded. */
async function draw(page, sources, plan, width = W, height = H, type = 'image/webp') {
  const base64 = await page.evaluate(async ({sources, plan, width, height, type}) => {
    const images = await Promise.all(sources.map(async src => { const img = new Image(); img.src = src; await img.decode(); return img; }));
    const canvas = document.createElement('canvas');
    canvas.width = width; canvas.height = height;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingQuality = 'high';
    new Function('ctx', 'images', 'W', 'H', plan)(ctx, images, width, height);
    return canvas.toDataURL(type, 0.82).split(',')[1];
  }, {sources, plan, width, height, type});
  return Buffer.from(base64, 'base64');
}

/** The largest crop of the given aspect centred on `focus`, kept inside the picture. */
const cropPlan = (crop, focus = [0.5, 0.5]) => `
  const img = images[0], iw = img.naturalWidth, ih = img.naturalHeight;
  let c = ${JSON.stringify(crop ?? null)};
  if (!c) {
    const scale = Math.min(iw / W, ih / H), w = W * scale, h = H * scale;
    const x = Math.min(Math.max(iw * ${focus[0]} - w / 2, 0), iw - w), y = Math.min(Math.max(ih * ${focus[1]} - h / 2, 0), ih - h);
    c = {x, y, width: w, height: h};
  }
  ctx.drawImage(img, c.x, c.y, c.width, c.height, 0, 0, W, H);`;

const pairPlan = `
  ctx.fillStyle = '#e9ece8'; ctx.fillRect(0, 0, W, H);
  const h = 560, gap = 28;
  const widths = images.map(img => img.naturalWidth * h / img.naturalHeight);
  let x = (W - widths[0] - widths[1] - gap) / 2;
  images.forEach((img, i) => {
    ctx.save(); ctx.shadowColor = 'rgba(22,29,34,.22)'; ctx.shadowBlur = 24; ctx.shadowOffsetY = 8;
    ctx.drawImage(img, x, (H - h) / 2, widths[i], h); ctx.restore();
    x += widths[i] + gap;
  });`;

const server = await serve(0);
const base = `http://127.0.0.1:${server.address().port}/`;
const browser = await chromium.launch({executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', args: ['--no-sandbox']});
const out = join(site, 'assets/img/cards');
mkdirSync(out, {recursive: true});
try {
  const canvasPage = await browser.newPage();
  await canvasPage.goto(base + 'scripts/og.html');
  for (const [slug, card] of Object.entries(cards)) {
    if (only.length && !only.includes(slug)) continue;
    let bytes;
    if (card.shot) {
      const page = await browser.newPage({viewport: {width: 1360, height: 1000}, deviceScaleFactor: 2, reducedMotion: 'reduce', colorScheme: 'light'});
      await page.goto(base + card.shot, {waitUntil: 'networkidle'});
      if (card.shot.includes('#/')) await page.waitForFunction(() => !document.querySelector('main[aria-busy]') && document.querySelector('main h1'));
      await card.prepare?.(page);
      const element = page.locator(card.element).first();
      const box = await element.boundingBox();
      const png = card.clip
        ? await page.screenshot({clip: {x: box.x + card.clip.x, y: box.y + card.clip.y, width: card.clip.width, height: card.clip.height}})
        : await element.screenshot();
      await page.close();
      bytes = await draw(canvasPage, [`data:image/png;base64,${png.toString('base64')}`], cropPlan(null, card.focus ?? [0.5, 0.5]));
    } else if (card.pair) {
      bytes = await draw(canvasPage, card.pair.map(dataUrl), pairPlan);
    } else {
      bytes = await draw(canvasPage, [dataUrl(card.file)], cropPlan(card.crop, card.focus));
    }
    writeFileSync(join(out, `${slug}.webp`), bytes);
    console.log(`${slug}.webp  ${(bytes.length / 1024).toFixed(0)} KB`);
  }
  if (!only.length) {
    // Icons from the SVG favicon: a 32px PNG for browsers that do not read SVG, and the 180px home-screen icon.
    const svg = readFileSync(join(site, 'assets/img/favicon.svg'), 'utf8');
    for (const [name, size, pad] of [['favicon-32.png', 32, 0], ['apple-touch-icon.png', 180, 0]]) {
      const icon = await browser.newPage({viewport: {width: size, height: size}});
      await icon.setContent(`<style>html,body{margin:0;background:${size > 32 ? '#14382b' : 'transparent'}}svg{display:block;width:${size - 2 * pad}px;height:${size - 2 * pad}px;margin:${pad}px}</style>${size > 32 ? svg.replace('rx="6"', 'rx="0"') : svg}`);
      writeFileSync(join(site, 'assets/img', name), await icon.screenshot({omitBackground: size === 32}));
      await icon.close();
      console.log(name);
    }
  }
} finally {
  await browser.close();
  server.close();
}

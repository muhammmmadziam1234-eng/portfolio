#!/usr/bin/env node
// Records a silent, captioned walkthrough of this site as an MP4 for an Upwork portfolio entry.
// It drives the real pages, so what the video shows is what a visitor can do.
// usage: node scripts/upwork/record.mjs [output.mp4]       (needs ffmpeg on the PATH)
// Upwork project videos: MP4, up to 60 seconds. The script fails if the result is longer.
import {execFileSync} from 'node:child_process';
import {mkdirSync, mkdtempSync, readdirSync, rmSync, statSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';
import {chromium} from 'playwright-core';
import {serve} from '../serve.mjs';

const output = resolve(process.argv[2] ?? 'upwork/walkthrough.mp4');
mkdirSync(resolve(output, '..'), {recursive: true});
const work = mkdtempSync(join(tmpdir(), 'walkthrough-'));
const server = await serve(0);
const base = `http://127.0.0.1:${server.address().port}/`;
const browser = await chromium.launch({executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', args: ['--no-sandbox']});
const context = await browser.newContext({viewport: {width: 1280, height: 720}, reducedMotion: 'no-preference', recordVideo: {dir: work, size: {width: 1280, height: 720}}});
const page = await context.newPage();

// A caption bar and a visible pointer, drawn inside the page so they appear in the recording.
await page.addInitScript(() => {
  const zoom = 0.85; // fits a whole demo above the caption bar in a 1280 by 720 frame
  const ready = () => {
    if (document.getElementById('rec-caption')) return;
    document.documentElement.style.zoom = String(zoom);
    const style = document.createElement('style');
    style.textContent = `#rec-caption{position:fixed;left:0;right:0;bottom:0;z-index:99999;padding:16px 36px 18px;background:rgba(20,28,34,.92);color:#fff;font:600 30px/1.25 Archivo,Arial,sans-serif;letter-spacing:-.005em;transition:opacity .25s}
    #rec-caption:empty{opacity:0}
    #rec-dot{position:fixed;z-index:100000;width:22px;height:22px;margin:-11px 0 0 -11px;border-radius:50%;background:rgba(255,243,161,.85);border:2px solid #14382b;pointer-events:none;left:-40px;top:-40px;transition:transform .12s}
    #rec-dot.down{transform:scale(.7)}`;
    document.head.append(style);
    const caption = Object.assign(document.createElement('div'), {id: 'rec-caption'});
    const dot = Object.assign(document.createElement('div'), {id: 'rec-dot'});
    document.body.append(caption, dot);
    addEventListener('mousemove', e => { dot.style.left = e.clientX / zoom + 'px'; dot.style.top = e.clientY / zoom + 'px'; }, true);
    addEventListener('mousedown', () => dot.classList.add('down'), true);
    addEventListener('mouseup', () => dot.classList.remove('down'), true);
  };
  if (document.readyState === 'loading') addEventListener('DOMContentLoaded', ready); else ready();
});

const say = async (text, ms) => { await page.evaluate(t => { document.getElementById('rec-caption').textContent = t; }, text); await page.waitForTimeout(ms); };
const glide = async (x, y, steps = 24) => page.mouse.move(x, y, {steps});
const centre = async locator => { const b = await locator.boundingBox(); return [b.x + b.width / 2, b.y + b.height / 2]; };
const go = async (hash, settle = 400) => {
  await page.evaluate(h => { document.getElementById('rec-caption').textContent = ''; location.hash = h; }, hash);
  await page.waitForFunction(h => location.hash === h && !document.querySelector('main[aria-busy]'), hash);
  await page.waitForTimeout(settle);
};

const started = Date.now();
await page.goto(base, {waitUntil: 'networkidle'});
await page.mouse.move(640, 360);

// Home: the first sensor picture pulls itself apart once.
await say('Eight projects you can try, each with its proof', 4600);

// Sensor
await go('#/p/sensor');
await say('Pull a 3D-modelled sensor apart', 600);
const slider = page.getByRole('slider').first();
const [sx, sy] = await centre(slider);
await glide(sx - 330, sy); await page.mouse.down();
for (let i = 0; i <= 20; i++) { await page.mouse.move(sx - 330 + i * 33, sy); await page.waitForTimeout(110); }
await page.mouse.up();
await say('Then open its drawing sheets, measured from the model', 600);
await page.getByRole('tab', {name: 'Drawing sheets'}).click();
await page.waitForTimeout(700);
await page.getByRole('button', {name: 'Zoom in'}).click(); await page.waitForTimeout(500);
await page.getByRole('button', {name: 'Zoom in'}).click(); await page.waitForTimeout(900);

// Lamp
await go('#/p/lamp');
await say('Move a lamp through its checked poses', 500);
for (const pose of ['Raised', 'Forward', 'Lowered']) {
  const [bx, by] = await centre(page.getByRole('button', {name: pose, exact: true}));
  await glide(bx, by, 14); await page.mouse.click(bx, by); await page.waitForTimeout(950);
}

// Ads
await go('#/p/ads');
await say('Ads and silent story videos, composed in Python', 500);
await page.mouse.wheel(0, 380); await page.waitForTimeout(1500);

// PCB
await go('#/p/pcb');
await say('Click a track on a four-layer board to light its whole net', 700);
const spot = await page.evaluate(() => {
  const hits = [...document.querySelectorAll('.board-svg line.hit')];
  const longest = hits.reduce((a, b) => (b.getTotalLength?.() ?? 0) > (a.getTotalLength?.() ?? 0) ? b : a);
  const r = longest.getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2];
});
await glide(spot[0], spot[1], 30); await page.mouse.click(spot[0], spot[1]); await page.waitForTimeout(1800);
await say('Or pick a part and see it framed on the board', 300);
await page.selectOption('#pcb-part', 'U1'); await page.waitForTimeout(2200);

const seconds = (Date.now() - started) / 1000;
await context.close(); await browser.close(); server.close();
const webm = join(work, readdirSync(work).find(f => f.endsWith('.webm')));
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', webm, '-vf', 'fps=30,format=yuv420p', '-c:v', 'libx264', '-crf', '22', '-preset', 'slow', '-movflags', '+faststart', '-an', output]);
rmSync(work, {recursive: true, force: true});
const length = Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', output], {encoding: 'utf8'}));
console.log(`${output}: ${length.toFixed(1)} s, ${(statSync(output).size / 1e6).toFixed(1)} MB (recorded in ${seconds.toFixed(1)} s)`);
if (length > 60) { console.error('The video is longer than the 60 seconds Upwork allows for a project video.'); process.exit(1); }

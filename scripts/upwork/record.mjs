#!/usr/bin/env node
// Records silent, captioned videos of this site for Upwork portfolio entries: one short clip per project and one combined tour.
// It drives the real pages, so what a video shows is what a visitor can do.
//
// usage: node scripts/upwork/record.mjs [output folder] [--only sensor,lamp]
//   needs ffmpeg and ffprobe on the PATH, and Chrome or Chromium (CHROME_PATH)
// Upwork project videos: MP4, up to 60 seconds. The script fails if the combined tour is longer.
import {execFileSync} from 'node:child_process';
import {copyFileSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright-core';
import {serve} from '../serve.mjs';
import {scenes} from './scenes.mjs';
import {overlay, tools} from './overlay.mjs';

const site = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const args = process.argv.slice(2);
const option = name => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : ''; };
const out = resolve(args.find(a => !a.startsWith('--') && a !== option('only')) ?? 'upwork/video');
const only = option('only').split(',').filter(Boolean);
mkdirSync(out, {recursive: true});
const work = mkdtempSync(join(tmpdir(), 'clips-'));
const server = await serve(0);
const base = `http://127.0.0.1:${server.address().port}/`;
const browser = await chromium.launch({executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', args: ['--no-sandbox']});

const withGo = page => ({
  ...tools(page),
  go: async hash => {
    await page.evaluate(h => { document.getElementById('rec-caption').textContent = ''; location.hash = h; }, hash);
    await page.waitForFunction(h => location.hash === h && !document.querySelector('main[aria-busy]'), hash);
    await page.waitForTimeout(400);
  }
});

const recorded = [];
const encode = ['-vf', 'fps=30,format=yuv420p', '-c:v', 'libx264', '-crf', '22', '-preset', 'slow', '-movflags', '+faststart', '-an'];
const length = file => Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file], {encoding: 'utf8'}));
for (const [slug, scene] of Object.entries(scenes)) {
  if (only.length && !only.includes(slug)) continue;
  if (scene.existing) {
    // A project that has its own, longer recording: keep the full recording and cut the last part for the tour.
    const full = join(site, `assets/media/${scene.existing}/walkthrough.mp4`), {steps} = JSON.parse(readFileSync(join(site, `data/${scene.existing}-steps.json`), 'utf8'));
    const mp4 = join(out, `${slug}.mp4`);
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-ss', String(steps[steps.length - 2].at), '-i', full, ...encode, mp4]);
    copyFileSync(full, join(out, `${slug}-full.mp4`));
    recorded.push(mp4);
    console.log(`${slug}: ${length(mp4).toFixed(1)} s (the last part of its full ${length(full).toFixed(1)} s recording)`);
    continue;
  }
  const context = await browser.newContext({viewport: {width: 1280, height: 720}, reducedMotion: 'no-preference', recordVideo: {dir: join(work, slug), size: {width: 1280, height: 720}}});
  await context.addInitScript(overlay, {zoom: scene.zoom ?? 0.85});   // coordinates inside a frame do not follow a CSS zoom, so scenes with a frame say zoom: 1
  const page = await context.newPage();
  await page.goto(base + (scene.hash ?? `#/p/${slug}`), {waitUntil: 'networkidle'});
  await page.mouse.move(640, 360);
  try { await scene.run(page, withGo(page), {base}); }
  catch (error) { await page.screenshot({path: join(out, `${slug}-failed.png`)}); throw error; }   // a picture of where it stopped
  await context.close();
  const webm = join(work, slug, readdirSync(join(work, slug)).find(f => f.endsWith('.webm')));
  const mp4 = join(out, `${slug}.mp4`);
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', webm, ...encode, mp4]);
  recorded.push(mp4);
  console.log(`${slug}: ${length(mp4).toFixed(1)} s, ${(statSync(mp4).size / 1e6).toFixed(1)} MB`);
}
await browser.close(); server.close();

if (!only.length && recorded.length > 1) {
  const tour = join(out, 'tour.mp4');
  const inputs = recorded.flatMap(f => ['-i', f]);
  const chain = recorded.map((_, i) => `[${i}:v]`).join('') + `concat=n=${recorded.length}:v=1:a=0[v]`;
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', ...inputs, '-filter_complex', chain, '-map', '[v]', '-c:v', 'libx264', '-crf', '22', '-preset', 'slow', '-pix_fmt', 'yuv420p', '-r', '30', '-movflags', '+faststart', tour]);
  const seconds = length(tour);
  console.log(`tour: ${seconds.toFixed(1)} s, ${(statSync(tour).size / 1e6).toFixed(1)} MB`);
  if (seconds > 60) { console.error('The tour is longer than the 60 seconds Upwork allows for a project video. Shorten the scenes.'); process.exitCode = 1; }
}
rmSync(work, {recursive: true, force: true});

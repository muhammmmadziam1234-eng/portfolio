#!/usr/bin/env node
// Records silent, captioned videos of this site for Upwork portfolio entries: one short clip per project and one combined tour.
// It drives the real pages, so what a video shows is what a visitor can do.
//
// usage: node scripts/upwork/record.mjs [output folder] [--only sensor,lamp]
//   needs ffmpeg and ffprobe on the PATH, and Chrome or Chromium (CHROME_PATH)
// Upwork project videos: MP4, up to 60 seconds. The script fails if the combined tour is longer.
import {execFileSync} from 'node:child_process';
import {copyFileSync, mkdirSync, mkdtempSync, readdirSync, rmSync, statSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';
import {chromium} from 'playwright-core';
import {serve} from '../serve.mjs';
import {scenes} from './scenes.mjs';
import {overlay, tools} from './overlay.mjs';

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
for (const [slug, scene] of Object.entries(scenes)) {
  if (only.length && !only.includes(slug)) continue;
  const context = await browser.newContext({viewport: {width: 1280, height: 720}, reducedMotion: 'no-preference', recordVideo: {dir: join(work, slug), size: {width: 1280, height: 720}}});
  await context.addInitScript(overlay, {zoom: 0.85});
  const page = await context.newPage();
  await page.goto(base + (scene.hash ?? `#/p/${slug}`), {waitUntil: 'networkidle'});
  await page.mouse.move(640, 360);
  await scene.run(page, withGo(page), {base});
  await context.close();
  const webm = join(work, slug, readdirSync(join(work, slug)).find(f => f.endsWith('.webm')));
  const mp4 = join(out, `${slug}.mp4`);
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', webm, '-vf', 'fps=30,format=yuv420p', '-c:v', 'libx264', '-crf', '22', '-preset', 'slow', '-movflags', '+faststart', '-an', mp4]);
  recorded.push(mp4);
  const seconds = Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', mp4], {encoding: 'utf8'}));
  console.log(`${slug}: ${seconds.toFixed(1)} s, ${(statSync(mp4).size / 1e6).toFixed(1)} MB`);
}
await browser.close(); server.close();

if (!only.length && recorded.length > 1) {
  const list = join(work, 'list.txt');
  writeFileSync(list, recorded.map(f => `file '${f}'`).join('\n'));
  const tour = join(out, 'tour.mp4');
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', '-movflags', '+faststart', tour]);
  const seconds = Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', tour], {encoding: 'utf8'}));
  console.log(`tour: ${seconds.toFixed(1)} s, ${(statSync(tour).size / 1e6).toFixed(1)} MB`);
  if (seconds > 60) { console.error('The tour is longer than the 60 seconds Upwork allows for a project video. Shorten the scenes.'); process.exitCode = 1; }
}
rmSync(work, {recursive: true, force: true});

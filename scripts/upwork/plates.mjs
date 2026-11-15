#!/usr/bin/env node
// Makes the still images for the Upwork portfolio entries: each is a picture of a real demo on this site in a telling state,
// centred on a neutral 4:3 sheet (1500 by 1125 pixels, so Upwork's recommended 1000 by 750 shape).
// usage: node scripts/upwork/plates.mjs [output folder] [--only pcb,lamp]
import {mkdirSync, mkdtempSync, readFileSync, rmSync, statSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';
import {chromium} from 'playwright-core';
import {serve} from '../serve.mjs';
import {shots} from './shots.mjs';

const args = process.argv.slice(2);
const option = name => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : ''; };
const out = resolve(args.find(a => !a.startsWith('--') && a !== option('only')) ?? 'upwork/images');
const only = option('only').split(',').filter(Boolean);
mkdirSync(out, {recursive: true});
const work = mkdtempSync(join(tmpdir(), 'plates-'));
const server = await serve(0);
const base = `http://127.0.0.1:${server.address().port}/`;
const browser = await chromium.launch({executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', args: ['--no-sandbox']});
const context = await browser.newContext({viewport: {width: 1280, height: 900}, deviceScaleFactor: 2, reducedMotion: 'reduce'});
const page = await context.newPage();
const sheet = await context.newPage();

for (const [slug, list] of Object.entries(shots)) {
  if (only.length && !only.includes(slug)) continue;
  await page.goto(`${base}#/p/${slug}`, {waitUntil: 'networkidle'});
  await page.waitForFunction(() => !document.querySelector('main[aria-busy]'));
  let n = 0;
  for (const shot of list) {
    n += 1;
    await shot(page);
    await page.waitForTimeout(500);
    const raw = join(work, `${slug}-${n}.png`);
    await page.locator('.exhibit').screenshot({path: raw});
    const file = join(out, `${slug}-${n}.jpg`);
    await sheet.setViewportSize({width: 1500, height: 1125});
    await sheet.setContent(`<body style="margin:0;width:1500px;height:1125px;background:#eceff1;display:grid;place-items:center;overflow:hidden">
      <img id="shot" src="data:image/png;base64,${readFileSync(raw).toString('base64')}" style="max-width:1380px;max-height:1005px;box-shadow:0 0 0 1px #cdd4d9;background:#fff"></body>`);
    await sheet.waitForFunction(() => document.getElementById('shot').complete);
    await sheet.screenshot({path: file, type: 'jpeg', quality: 90});
    console.log(`${slug}-${n}.jpg  ${(statSync(file).size / 1024).toFixed(0)} KB`);
  }
}
await browser.close(); server.close();
rmSync(work, {recursive: true, force: true});

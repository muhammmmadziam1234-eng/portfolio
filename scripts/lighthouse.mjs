#!/usr/bin/env node
// Runs Lighthouse against this site on a local server and records the scores, so the numbers can be checked.
// usage: node scripts/lighthouse.mjs [--write]      (--write saves docs/evidence/lighthouse.json)
// Uses Lighthouse's default settings: a simulated mid-range phone on a slow connection.
import {writeFileSync, mkdirSync} from 'node:fs';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright-core';
import lighthouse from 'lighthouse';
import {serve} from './serve.mjs';
import {projects} from '../assets/js/projects.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const pages = [['Home', ''], ...projects.map(p => [p.title, `#/p/${p.slug}`])];
const port = 9341;
const server = await serve(0);
const base = `http://127.0.0.1:${server.address().port}/`;
const browser = await chromium.launchPersistentContext('', {
  executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', args: ['--no-sandbox', `--remote-debugging-port=${port}`], headless: true});
const results = [];
for (const [name, route] of pages) {
  const run = await lighthouse(base + route, {port, output: 'json', logLevel: 'error', onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo']});
  const score = id => Math.round(run.lhr.categories[id].score * 100);
  results.push({page: name, address: route || '/', performance: score('performance'), accessibility: score('accessibility'), bestPractices: score('best-practices'), seo: score('seo'),
    fcpMs: Math.round(run.lhr.audits['first-contentful-paint'].numericValue), lcpMs: Math.round(run.lhr.audits['largest-contentful-paint'].numericValue),
    tbtMs: Math.round(run.lhr.audits['total-blocking-time'].numericValue), speedIndexMs: Math.round(run.lhr.audits['speed-index'].numericValue), cls: Number(run.lhr.audits['cumulative-layout-shift'].numericValue.toFixed(3)), totalBytes: run.lhr.audits['total-byte-weight'].numericValue});
  const r = results[results.length - 1];
  console.log(`${name}: performance ${r.performance}, accessibility ${r.accessibility}, best practices ${r.bestPractices}, SEO ${r.seo} | FCP ${r.fcpMs} ms, LCP ${r.lcpMs} ms, TBT ${r.tbtMs} ms, CLS ${r.cls}, ${Math.round(r.totalBytes / 1024)} KB`);
}
const record = {tool: `Lighthouse ${(await import('lighthouse/package.json', {with: {type: 'json'}})).default.version}`, browser: browser.browser()?.version?.() ?? 'Chromium',
  date: new Date().toISOString().slice(0, 10), setting: 'Lighthouse defaults (simulated mobile), local server sending text compressed as GitHub Pages does, run once per page', pages: results};
if (process.argv.includes('--write')) {
  mkdirSync(resolve(root, 'docs/evidence'), {recursive: true});
  writeFileSync(resolve(root, 'docs/evidence/lighthouse.json'), JSON.stringify(record, null, 2) + '\n');
  console.log('wrote docs/evidence/lighthouse.json');
}
await browser.close(); server.close();

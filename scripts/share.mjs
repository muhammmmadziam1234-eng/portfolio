#!/usr/bin/env node
// Writes the social share pictures (assets/img/og.jpg and assets/img/share/<slug>.jpg, 1200 by 630)
// and one small share page per project (p/<slug>/index.html) that carries that project's preview tags and then opens the app.
// Run it by hand when a project, a card picture or site.config.js changes, then commit the output; the site never runs it.
//
// usage: node scripts/share.mjs
//   CHROME_PATH picks the browser, as for the tests.
import {mkdirSync, writeFileSync} from 'node:fs';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {chromium} from 'playwright-core';
import {serve} from './serve.mjs';

const site = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const {default: config} = await import(pathToFileURL(join(site, 'site.config.js')));
const {projects} = await import(pathToFileURL(join(site, 'assets/js/projects.js')));

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const name = config.name || 'Portfolio';
const root = config.siteUrl.endsWith('/') ? config.siteUrl : config.siteUrl + '/';

function page(p) {
  const url = `${root}p/${p.slug}/`;
  const title = `${p.title}: ${name}`;
  const description = `${p.short} ${p.summary}`;
  const target = `../../#/p/${p.slug}`;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${esc(url)}">
<meta property="og:type" content="website">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${esc(url)}">
<meta property="og:image" content="${esc(`${root}assets/img/share/${p.slug}.jpg`)}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="${esc(`${p.title}, ${p.kind}`)}">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="../../assets/img/favicon.svg" type="image/svg+xml">
<link rel="icon" href="../../assets/img/favicon-32.png" sizes="32x32" type="image/png">
<link rel="apple-touch-icon" href="../../assets/img/apple-touch-icon.png">
<meta http-equiv="refresh" content="0; url=${esc(target)}">
<script>location.replace(${JSON.stringify(target).replace(/</g, '\\u003c')});</script>
</head>
<body>
<p><a href="${esc(target)}">Open ${esc(p.title)}</a></p>
</body>
</html>
`;
}

const server = await serve(0);
const base = `http://127.0.0.1:${server.address().port}/`;
const browser = await chromium.launch({executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', args: ['--no-sandbox']});
try {
  const context = await browser.newContext({viewport: {width: 1200, height: 630}, deviceScaleFactor: 1, reducedMotion: 'reduce', colorScheme: 'light'});
  const shoot = async (query, file) => {
    const tab = await context.newPage();
    const errors = [];
    tab.on('pageerror', e => errors.push(e.message));
    await tab.goto(`${base}scripts/og.html${query}`, {waitUntil: 'load'});
    await tab.waitForFunction(() => document.body.dataset.ready === '1', null, {timeout: 15000});
    const bytes = await tab.screenshot({type: 'jpeg', quality: 85});
    await tab.close();
    if (errors.length) throw new Error(`${query || 'default'}: ${errors.join('; ')}`);
    mkdirSync(dirname(file), {recursive: true});
    writeFileSync(file, bytes);
    console.log(`${file.slice(site.length + 1)}  ${(bytes.length / 1024).toFixed(0)} KB`);
  };
  await shoot('', join(site, 'assets/img/og.jpg'));
  for (const p of projects) {
    await shoot(`?p=${encodeURIComponent(p.slug)}`, join(site, `assets/img/share/${p.slug}.jpg`));
    const file = join(site, `p/${p.slug}/index.html`);
    mkdirSync(dirname(file), {recursive: true});
    writeFileSync(file, page(p));
    console.log(file.slice(site.length + 1));
  }
} finally {
  await browser.close();
  server.close();
}

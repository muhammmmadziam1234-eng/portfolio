import {test, before, after} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {launch, open} from './helpers.mjs';
import config from '../site.config.js';
import {projects} from '../assets/js/projects.js';

let env;
before(async () => { env = await launch(); });
after(async () => { await env.close(); });

const meta = (html, attr, key) => html.match(new RegExp(`<meta ${attr}="${key}" content="([^"]*)"`))?.[1];
const unescape = s => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');

async function size(file) {
  const page = await env.browser.newPage();
  try {
    await page.goto(env.base + file);
    return await page.evaluate(() => { const i = document.images[0]; return [i.naturalWidth, i.naturalHeight]; });
  } finally { await page.close(); }
}

test('site share picture is 1200 by 630', async () => {
  assert.deepEqual(await size('assets/img/og.jpg'), [1200, 630]);
});

for (const p of projects) {
  test(`share page for ${p.slug}`, async () => {
    const html = readFileSync(new URL(`../p/${p.slug}/index.html`, import.meta.url), 'utf8');
    const url = `${config.siteUrl}p/${p.slug}/`;
    assert.equal(unescape(html.match(/<title>([^<]*)<\/title>/)[1]), `${p.title}: ${config.name}`);
    assert.equal(unescape(meta(html, 'property', 'og:title')), `${p.title}: ${config.name}`);
    assert.equal(meta(html, 'property', 'og:url'), url);
    assert.match(html, new RegExp(`<link rel="canonical" href="${url}">`));
    assert.equal(meta(html, 'property', 'og:image'), `${config.siteUrl}assets/img/share/${p.slug}.jpg`);
    assert.ok(meta(html, 'name', 'description').length > 0);
    assert.equal(unescape(meta(html, 'name', 'description')), `${p.short} ${p.summary}`);
    assert.deepEqual(await size(`assets/img/share/${p.slug}.jpg`), [1200, 630]);
  });

  for (const route of [`p/${p.slug}/`, `p/${p.slug}`]) {
    test(`/${route} opens the project`, async () => {
      const context = await env.browser.newContext();
      const page = await context.newPage();
      const errors = [], outside = [];
      page.on('pageerror', e => errors.push(e.message));
      page.on('request', r => { const u = new URL(r.url()); if (/^https?:$/.test(u.protocol) && u.hostname !== '127.0.0.1') outside.push(r.url()); });
      try {
        await page.goto(env.base + route, {waitUntil: 'load'});
        await page.waitForURL(u => u.hash === `#/p/${p.slug}`);
        await page.waitForFunction(() => !document.querySelector('main[aria-busy]') && document.querySelector('main h1'));
        assert.ok(page.url().endsWith(`#/p/${p.slug}`), page.url());
        assert.equal((await page.locator('main h1').first().textContent()).trim(), p.title);
        assert.deepEqual(errors, []);
        assert.deepEqual(outside, []);
      } finally { await context.close(); }
    });
  }
}

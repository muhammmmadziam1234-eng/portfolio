import {test, before, after} from 'node:test';
import assert from 'node:assert/strict';
import {launch, open, axeViolations, wanted} from './helpers.mjs';
import {projects} from '../assets/js/projects.js';
import config from '../site.config.js';

let env;
before(async () => { env = await launch(); });
after(async () => { await env.close(); });

const routes = [['home', ''], ['all projects', '#/all'], ['contact', '#/contact'], ['about', '#/about'], ['method', '#/method'], ...projects.filter(p => wanted(p.slug)).map(p => [p.slug, `#/p/${p.slug}`])];
const screens = [['desktop', 1280, 800], ['phone', 360, 740]];
const schemes = ['light', 'dark'];

for (const [name, route] of routes) {
  for (const [screen, width, height] of screens) {
    for (const colorScheme of schemes) test(`${name} on a ${screen}, ${colorScheme}: loads cleanly, stays on this site, fits the screen, has no axe violations`, async () => {
      const {page, context, log} = await open(env.browser, env.base, route, {width, height, reducedMotion: 'reduce', colorScheme});
      try {
        assert.deepEqual(log.errors, [], 'console or page errors');
        assert.deepEqual(log.bad, [], 'failed requests');
        assert.deepEqual(log.outside, [], 'requests to other sites');
        assert.equal((await context.cookies()).length, 0, 'cookies');
        assert.ok((await page.title()).length > 12, 'page title');
        assert.ok((await page.locator('meta[name=description]').getAttribute('content')).length > 50, 'page description');
        assert.equal(await page.locator('h1').count(), 1, 'exactly one h1');
        if (config.upworkUrl) assert.ok(await page.locator('#upwork').isVisible(), 'the hire button is in the header');
        assert.ok((await page.locator('.site-header').boundingBox()).height <= 80, 'the header is one row');
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        assert.ok(overflow <= 0, `horizontal overflow of ${overflow}px`);
        assert.deepEqual(await axeViolations(page), [], 'axe violations');
      } finally { await context.close(); }
    });
  }
}

test('the skip link is the first stop and moves focus to the content', async () => {
  const {page, context} = await open(env.browser, env.base, '', {reducedMotion: 'reduce'});
  try {
    await page.keyboard.press('Tab');
    assert.equal(await page.evaluate(() => document.activeElement.className), 'skip');
    await page.keyboard.press('Enter');
    assert.equal(await page.evaluate(() => document.activeElement.id), 'main');
  } finally { await context.close(); }
});

test('moving between projects keeps the tour order and announces the new page', async () => {
  const {page, context} = await open(env.browser, env.base, '#/p/sensor', {reducedMotion: 'reduce'});
  try {
    await page.getByRole('link', {name: /Next project/}).click();
    await page.waitForFunction(() => location.hash === '#/p/lamp' && /lamp/i.test(document.querySelector('main h1')?.textContent ?? ''));
    assert.match(await page.locator('h1').innerText(), /lamp/i);
    await page.waitForFunction(() => document.activeElement?.tagName === 'H1');
    await page.waitForFunction(() => document.querySelector('#live').textContent.includes('project 7 of 8'));
  } finally { await context.close(); }
});

test('an unknown address says so and offers the projects, instead of showing the home page', async () => {
  const {page, context, log} = await open(env.browser, env.base, '#/p/nothing-here', {reducedMotion: 'reduce'});
  try {
    assert.match(await page.locator('h1').innerText(), /That page does not exist/);
    assert.match(await page.title(), /not found/i);
    assert.equal(await page.getByRole('link', {name: 'See all projects'}).getAttribute('href'), '#/all');
    assert.deepEqual(log.errors, []);
  } finally { await context.close(); }
});

test('on a phone the links fold into a menu that opens, closes with Escape and closes on navigation', async () => {
  const {page, context} = await open(env.browser, env.base, '', {width: 360, height: 740, reducedMotion: 'reduce'});
  try {
    const toggle = page.getByRole('button', {name: 'Menu'});
    const work = page.locator('#site-nav').getByRole('link', {name: 'Work'});
    assert.equal(await toggle.getAttribute('aria-expanded'), 'false');
    assert.equal(await work.isVisible(), false, 'links hidden while the menu is closed');
    await toggle.click();
    assert.equal(await toggle.getAttribute('aria-expanded'), 'true');
    assert.ok(await work.isVisible(), 'links shown when the menu is open');
    await page.keyboard.press('Escape');
    assert.equal(await toggle.getAttribute('aria-expanded'), 'false');
    assert.equal(await page.evaluate(() => document.activeElement.className), 'menu-toggle', 'focus goes back to the menu button');
    await toggle.click();
    await page.locator('#site-nav').getByRole('link', {name: 'About'}).click();
    await page.waitForFunction(() => location.hash === '#/about' && document.querySelector('main h1')?.textContent === 'About');
    assert.equal(await toggle.getAttribute('aria-expanded'), 'false');
    assert.equal(await page.evaluate(() => document.activeElement.tagName), 'H1');
  } finally { await context.close(); }
});

test('the contact address scrolls to the contact band, which offers the hire button', async () => {
  const {page, context} = await open(env.browser, env.base, '#/contact', {reducedMotion: 'reduce'});
  try {
    await page.waitForFunction(() => { const r = document.querySelector('#contact').getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight; });
    if (config.upworkUrl) assert.equal(await page.locator('.contact-band').getByRole('link', {name: 'Hire me on Upwork'}).getAttribute('href'), config.upworkUrl);
    if (config.email) assert.equal(await page.locator('.contact-band').getByRole('link', {name: 'Send an email'}).getAttribute('href'), `mailto:${config.email}`);
    assert.equal(await page.locator('#site-nav a[href="#/contact"]').getAttribute('aria-current'), 'page');
  } finally { await context.close(); }
});

test('the about page shows only what the config fills in, and lists skills by discipline', async () => {
  const {page, context} = await open(env.browser, env.base, '#/about', {reducedMotion: 'reduce'});
  try {
    assert.equal(await page.locator('.about-facts').count(), config.location || config.availability ? 1 : 0);
    assert.equal(await page.locator('.about-photo').count(), config.photo ? 1 : 0);
    if (config.bio) assert.match(await page.locator('.lead').innerText(), new RegExp(config.bio.slice(0, 20).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    assert.equal(await page.locator('.skills h3').count(), 3);
    assert.match(await page.title(), /About/);
  } finally { await context.close(); }
});

test('every page stays within 1200 pixels of content and never scrolls sideways, from 320 to 2560 pixels wide', async () => {
  for (const width of [320, 2560]) {
    for (const route of ['', '#/about', '#/method', '#/p/pcb', '#/p/ads']) {
      const {page, context} = await open(env.browser, env.base, route, {width, height: 900, reducedMotion: 'reduce'});
      try {
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        assert.ok(overflow <= 0, `${route || 'home'} at ${width}: horizontal overflow of ${overflow}px`);
        const widest = await page.evaluate(() => Math.max(...[...document.querySelectorAll('.container')].map(c => { const s = getComputedStyle(c); return c.clientWidth - parseFloat(s.paddingLeft) - parseFloat(s.paddingRight); })));
        assert.ok(widest <= 1200, `${route || 'home'} at ${width}: content ${widest}px wide`);
      } finally { await context.close(); }
    }
  }
});

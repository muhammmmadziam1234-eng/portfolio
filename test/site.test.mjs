import {test, before, after} from 'node:test';
import assert from 'node:assert/strict';
import {launch, open, axeViolations, wanted} from './helpers.mjs';
import {projects} from '../assets/js/projects.js';

let env;
before(async () => { env = await launch(); });
after(async () => { await env.close(); });

const routes = [['home', ''], ['all projects', '#/all'], ['method', '#/method'], ...projects.filter(p => wanted(p.slug)).map(p => [p.slug, `#/p/${p.slug}`])];
const screens = [['desktop', 1280, 800], ['phone', 360, 740]];

for (const [name, route] of routes) {
  for (const [screen, width, height] of screens) {
    test(`${name} on a ${screen}: loads cleanly, stays on this site, fits the screen, has no axe violations`, async () => {
      const {page, context, log} = await open(env.browser, env.base, route, {width, height, reducedMotion: 'reduce'});
      try {
        assert.deepEqual(log.errors, [], 'console or page errors');
        assert.deepEqual(log.bad, [], 'failed requests');
        assert.deepEqual(log.outside, [], 'requests to other sites');
        assert.equal((await context.cookies()).length, 0, 'cookies');
        assert.ok((await page.title()).length > 12, 'page title');
        assert.equal(await page.locator('h1').count(), 1, 'exactly one h1');
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
    await page.waitForFunction(() => document.querySelector('#live').textContent.includes('project 2 of 8'));
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

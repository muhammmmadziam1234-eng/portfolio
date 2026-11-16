import {chromium} from 'playwright-core';
import axe from 'axe-core';
import {serve} from '../scripts/serve.mjs';

/** Start the site on a free port and a browser. Set CHROME_PATH to use a specific Chrome or Chromium. */
export async function launch() {
  const server = await serve(0);
  const base = `http://127.0.0.1:${server.address().port}/`;
  const browser = await chromium.launch({executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', args: ['--no-sandbox']});
  return {base, browser, close: async () => { await browser.close(); server.close(); }};
}

/** Open a route in a fresh context and record everything that could go wrong while it loads. */
export async function open(browser, base, route, {width = 1280, height = 800, reducedMotion = 'no-preference', colorScheme = 'light'} = {}) {
  const context = await browser.newContext({viewport: {width, height}, reducedMotion, colorScheme});
  const page = await context.newPage();
  const log = {errors: [], outside: [], bad: []};
  page.on('pageerror', e => log.errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') log.errors.push(m.text()); });
  page.on('request', r => { const u = new URL(r.url()); if (/^https?:$/.test(u.protocol) && u.hostname !== '127.0.0.1') log.outside.push(r.url()); });
  page.on('response', r => { if (r.status() >= 400) log.bad.push(`${r.status()} ${r.url()}`); });
  await page.goto(base + route, {waitUntil: 'load'});
  await page.waitForFunction(() => !document.querySelector('main[aria-busy]') && document.querySelector('main h1'));
  await page.waitForTimeout(150);
  return {page, context, log};
}

/** Run axe-core against the page and return a short list of what it found. */
export async function axeViolations(page) {
  await page.addScriptTag({content: axe.source});
  return page.evaluate(async () => {
    const result = await axe.run(document, {runOnly: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice']});
    return result.violations.map(v => ({id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.map(n => n.target.join(' ')).slice(0, 4)}));
  });
}

/** Projects to test: all of them, or the ones named in ONLY (comma separated), for work in progress. */
export const only = (process.env.ONLY || '').split(',').filter(Boolean);
export const wanted = slug => !only.length || only.includes(slug);

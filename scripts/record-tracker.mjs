#!/usr/bin/env node
// Records a captioned walkthrough of the real Relay Desk app, for the portfolio's service desk page.
// It starts the app from a checkout of the project on a free port with a throwaway in-memory database and the published demo accounts,
// drives it in a browser the way a person would, and writes:
//   assets/media/tracker/walkthrough.mp4   the recording (silent; the captions are drawn into the picture)
//   assets/media/tracker/poster.jpg        the picture shown before it plays
//   data/tracker-steps.json                what happens and when, for the step list under the video
//
// usage: node scripts/record-tracker.mjs [--repo ../service-request-tracker] [--node /path/to/node-24]
//   The app needs Node 24 (it runs TypeScript directly), so --node is required when this script runs under an older Node.
//   Also needs ffmpeg and Chrome or Chromium (CHROME_PATH).
import {execFileSync, spawn} from 'node:child_process';
import {mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync, statSync} from 'node:fs';
import {createServer} from 'node:net';
import {tmpdir} from 'node:os';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright-core';
import {overlay, tools} from './upwork/overlay.mjs';

const site = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const option = (name, fallback) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : fallback; };
const repo = resolve(option('repo', resolve(site, '../service-request-tracker')));
const nodeBin = option('node', process.execPath);
const DEMO_PASSWORD = 'relay-demo-2026';   // published in the project's README; the demo accounts exist only in a throwaway database

const freePort = () => new Promise(done => { const s = createServer(); s.listen(0, '127.0.0.1', () => { const {port} = s.address(); s.close(() => done(port)); }); });
const port = await freePort(), origin = `http://127.0.0.1:${port}`;
const server = spawn(nodeBin, ['src/main.ts'], {cwd: repo, env: {...process.env, PORT: String(port), HOST: '127.0.0.1', REQUEST_DB: ':memory:', SEED_DEMO: '1', LOG: 'off'}, stdio: ['ignore', 'ignore', 'pipe']});
let serverError = '';
process.on('exit', () => server.kill('SIGTERM'));   // never leave the app running, even when a step fails
server.stderr.on('data', chunk => { serverError += chunk; });
for (let attempt = 0; ; attempt++) {
  try { if ((await fetch(origin + '/healthz')).ok) break; } catch { /* not up yet */ }
  if (attempt > 40 || server.exitCode !== null) { server.kill(); console.error('The app did not start.\n' + serverError); process.exit(1); }
  await new Promise(r => setTimeout(r, 250));
}

const work = mkdtempSync(join(tmpdir(), 'tracker-'));
const browser = await chromium.launch({executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', args: ['--no-sandbox']});
const context = await browser.newContext({viewport: {width: 1280, height: 720}, reducedMotion: 'no-preference', recordVideo: {dir: work, size: {width: 1280, height: 720}}});
await context.addInitScript(overlay, {zoom: 1});
const page = await context.newPage();
const started = Date.now();
const steps = [];
const mark = text => steps.push({at: Math.max(0, Math.round(((Date.now() - started) / 1000 - 0.3) * 10) / 10), text});
const {say, click, type} = tools(page);
const record = page.locator('#record');

async function signIn(username) {
  await type(page.getByLabel('Username'), username, 200);
  await type(page.getByLabel('Password'), DEMO_PASSWORD, 400);
  await click(page.getByRole('button', {name: 'Sign in'}), 300);
  await page.getByRole('heading', {name: 'Service requests', level: 1}).waitFor();
  await page.locator('#requests button.row').first().waitFor();
}

await page.goto(origin + '/');
await page.mouse.move(640, 360);
await page.getByLabel('Username').waitFor();

// 1. A requester signs in and opens a request
mark('Sign in as a requester');
await say('Sign in as a requester', 800);
await signIn('casey');
await say('A requester sees only their own requests', 2200);
mark('Open a new request');
await say('Open a new request', 400);
await click(page.getByRole('button', {name: '+ New request'}), 500);
const dialog = page.getByRole('dialog');
await type(dialog.getByLabel('Request title'), 'Replace the broken desk lamp', 200);
await dialog.getByLabel('Team').selectOption('Facilities');
await dialog.getByLabel('Priority').selectOption('Low');
await type(dialog.getByLabel('Description'), 'The lamp at desk B12 flickers and then goes out.', 500);
await click(dialog.getByRole('button', {name: 'Create request'}), 400);
await record.getByRole('heading', {name: 'Replace the broken desk lamp'}).waitFor();
await say('The request is saved with a reference number', 1800);

// 2. An agent signs in, assigns and comments
mark('Sign in as an agent');
await say('Sign out, then sign in as an agent', 400);
await click(page.getByRole('button', {name: 'Sign out'}), 400);
await page.getByRole('heading', {name: 'Sign in', level: 1}).waitFor();
await signIn('riley');
mark('Set priority, assignee and status');
await say('An agent sets priority, assignee and status together', 500);
await click(page.locator('button.row[data-id="1045"]'), 500);
await record.getByRole('heading', {name: 'Book a room for the Friday planning session'}).waitFor();
await record.getByLabel('Priority').selectOption('High');
await record.getByLabel('Assignee').selectOption({label: 'Morgan Brooks'});
await record.getByLabel('Status').selectOption('Assigned');
await page.waitForTimeout(500);
await click(record.getByRole('button', {name: 'Save changes'}), 900);
mark('Add a comment');
await say('Then adds a comment', 300);
await type(record.getByLabel('Add a comment'), 'Booked the large room on level 2.', 400);
await click(record.getByRole('button', {name: 'Post comment'}), 1500);

// 3. A second person changes the same request while it is open
mark('Two people edit the same request');
await say('Open a request that someone else is also editing', 400);
await click(page.locator('button.row[data-id="1041"]'), 500);
await record.getByRole('heading', {name: 'Request access to the CRM'}).waitFor();
await record.getByLabel('Priority').selectOption('Low');
await page.waitForTimeout(600);
const other = await browser.newContext();   // a second, separate sign-in, as a second person at another desk
const login = await other.request.post(origin + '/api/login', {data: {username: 'morgan', password: DEMO_PASSWORD}});
const {csrf_token: csrf} = await login.json();
const saved = await other.request.patch(origin + '/api/requests/1041', {headers: {'If-Match': '"1"', 'X-CSRF-Token': csrf}, data: {priority: 'High'}});
if (!saved.ok()) throw new Error('The second person\'s change was refused: ' + saved.status());
await say('Meanwhile a colleague saves a different priority first', 1500);
await click(record.getByRole('button', {name: 'Save changes'}), 300);
await page.locator('#message', {hasText: 'Someone updated this request'}).waitFor();
mark('The page shows the other change instead of overwriting it');
await say('The page says so and shows their version, not a silent overwrite', 3200);
await other.close();

const seconds = (Date.now() - started) / 1000;
await context.close(); await browser.close();
server.kill('SIGTERM');

const out = join(site, 'assets/media/tracker');
mkdirSync(out, {recursive: true});
const webm = join(work, readdirSync(work).find(f => f.endsWith('.webm')));
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', webm, '-vf', 'fps=30,format=yuv420p', '-c:v', 'libx264', '-crf', '24', '-preset', 'slow', '-movflags', '+faststart', '-an', join(out, 'walkthrough.mp4')]);
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-ss', String(steps.find(step => step.text.startsWith('Set priority')).at + 2.5), '-i', join(out, 'walkthrough.mp4'), '-frames:v', '1', '-q:v', '4', join(out, 'poster.jpg')]);
rmSync(work, {recursive: true, force: true});
const length = Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', join(out, 'walkthrough.mp4')], {encoding: 'utf8'}));
writeFileSync(join(site, 'data/tracker-steps.json'), JSON.stringify({seconds: Math.round(length * 10) / 10, steps}, null, 2) + '\n');
console.log(`walkthrough.mp4: ${length.toFixed(1)} s, ${(statSync(join(out, 'walkthrough.mp4')).size / 1e6).toFixed(1)} MB (recorded in ${seconds.toFixed(1)} s); ${steps.length} steps`);

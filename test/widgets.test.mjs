import {test, before, after} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {launch, open, wanted} from './helpers.mjs';
import {explodeFrames} from '../assets/js/media.js';

let env;
before(async () => { env = await launch(); });
after(async () => { await env.close(); });

const json = path => JSON.parse(readFileSync(new URL(`../${path}`, import.meta.url), 'utf8'));
const two = n => (Math.round(n * 100) / 100).toFixed(2);

async function withPage(route, options, run) {
  const {page, context, log} = await open(env.browser, env.base, route, {reducedMotion: 'reduce', ...options});
  try { await run(page, log); } finally { await context.close(); }
}

test('home: the slider pulls the sensor apart and says what it shows', async () => {
  await withPage('', {}, async page => {
    const range = page.getByRole('slider', {name: 'Pull the sensor apart'});
    await range.focus();
    await page.keyboard.press('End');
    assert.equal(await range.getAttribute('aria-valuetext'), 'Fully exploded');
    assert.equal(await page.locator('.scrub-frame img').getAttribute('src'), explodeFrames.at(-1).src);
    assert.match(await page.locator('.scrub-frame img').getAttribute('alt'), /fully exploded/);
    await page.keyboard.press('Home');
    assert.equal(await range.getAttribute('aria-valuetext'), 'Assembled');
    assert.equal(await page.locator('.scrub-frame img').getAttribute('src'), explodeFrames[0].src);
  });
});

test('home: dragging the picture scrubs it, and Play is off when motion is reduced', async () => {
  await withPage('', {}, async page => {
    assert.equal(await page.getByRole('button', {name: 'Play'}).isDisabled(), true);
    const box = await page.locator('.scrub-frame').boundingBox();
    await page.mouse.move(box.x + box.width * 0.2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.8, box.y + box.height / 2, {steps: 8});
    await page.mouse.up();
    assert.notEqual(await page.getByRole('slider').getAttribute('aria-valuetext'), 'Assembled');
  });
});

test('home: the intro plays once, and stops as soon as the visitor touches the slider', async () => {
  await withPage('', {reducedMotion: 'no-preference'}, async page => {
    await page.waitForFunction(() => Number(document.querySelector('.scrub-controls input').value) > 100, null, {timeout: 6000});
    await page.getByRole('slider').focus();
    await page.keyboard.press('Home');
    await page.waitForTimeout(800);
    assert.equal(await page.getByRole('slider').inputValue(), '0');
  });
});

test('home: the intro starts only once every frame is decoded, so the first run is as smooth as a replay', async () => {
  // The first run used to decode each picture at the moment it was first shown; a replay had nothing left to decode.
  const context = await env.browser.newContext({viewport: {width: 1280, height: 800}, reducedMotion: 'no-preference'});
  try {
    const page = await context.newPage();
    await page.addInitScript(() => {
      const decoded = new Set(), real = HTMLImageElement.prototype.decode;
      HTMLImageElement.prototype.decode = function () { return real.call(this).then(() => { decoded.add(this.currentSrc); }); };
      window.__atIntroStart = null;
      const watch = () => {
        const slider = document.querySelector('.scrub-controls input');
        if (slider && Number(slider.value) > 0 && window.__atIntroStart === null) window.__atIntroStart = [...decoded].filter(s => /explode-\d+\.webp/.test(s)).length;
        if (window.__atIntroStart === null) requestAnimationFrame(watch);
      };
      requestAnimationFrame(watch);
    });
    await page.goto(env.base, {waitUntil: 'load'});
    await page.waitForFunction(() => window.__atIntroStart !== null, null, {timeout: 10000});
    assert.equal(await page.evaluate(() => window.__atIntroStart), explodeFrames.length);
  } finally { await context.close(); }
});

test('home: motion glides between the rendered pictures, and a picture at rest is always a real render', async () => {
  await withPage('', {reducedMotion: 'no-preference'}, async page => {
    await page.waitForSelector('.scrub-frame.smooth', {timeout: 10000});
    assert.equal(await page.locator('.scrub-canvas').getAttribute('aria-hidden'), 'true', 'the canvas is decoration; the <img> carries the alt text');
    assert.match(await page.locator('.scrub-frame img').getAttribute('alt'), /Cirrus sensor/);
    await page.getByRole('slider').focus();
    await page.keyboard.press('Home');
    await page.waitForTimeout(700);
    const run = await page.evaluate(async () => {
      const slider = document.querySelector('.scrub-controls input'), canvas = document.querySelector('.scrub-canvas'), seen = new Set();
      slider.value = '1000'; slider.dispatchEvent(new Event('input', {bubbles: true}));
      for (let i = 0; i < 30; i++) { await new Promise(r => requestAnimationFrame(r)); seen.add(canvas.toDataURL('image/jpeg', 0.2)); }
      return seen.size;
    });
    // Eight rendered pictures lie between the first and last of the final stretch alone; the old widget showed one jump.
    assert.ok(run > 12, `the canvas passed through ${run} different pictures`);
    // At rest: set a position between two renders; the canvas must equal the nearest render drawn alone (no ghost of its neighbour).
    const rest = await page.evaluate(async () => {
      const slider = document.querySelector('.scrub-controls input'), canvas = document.querySelector('.scrub-canvas'), img = document.querySelector('.scrub-frame img');
      slider.value = '437'; slider.dispatchEvent(new Event('input', {bubbles: true}));
      await new Promise(r => setTimeout(r, 900));
      const ref = document.createElement('canvas'); ref.width = canvas.width; ref.height = canvas.height;
      const x = ref.getContext('2d'), pic = new Image(); pic.src = img.src; await pic.decode();
      const k = Math.min(canvas.width / pic.naturalWidth, canvas.height / pic.naturalHeight), w = pic.naturalWidth * k, h = pic.naturalHeight * k;
      x.fillStyle = '#232c33'; x.fillRect(0, 0, canvas.width, canvas.height); x.imageSmoothingQuality = 'high'; x.drawImage(pic, (canvas.width - w) / 2, (canvas.height - h) / 2, w, h);
      const a = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data, b = x.getImageData(0, 0, canvas.width, canvas.height).data;
      let diff = 0; for (let i = 0; i < a.length; i += 28) diff += Math.abs(a[i] - b[i]);
      return {diff: diff / (a.length / 28), src: img.getAttribute('src')};
    });
    assert.ok(rest.diff < 0.5, `at rest the canvas differs from ${rest.src} by ${rest.diff}`);
  });
});

test('home: with motion reduced the sensor stays a plain picture, with no canvas shown', async () => {
  await withPage('', {reducedMotion: 'reduce'}, async page => {
    await page.waitForTimeout(1200);
    assert.equal(await page.locator('.scrub-frame.smooth').count(), 0);
    assert.equal(await page.locator('.scrub-canvas').isVisible(), false);
    assert.equal(await page.locator('.scrub-frame img').isVisible(), true);
  });
});

test('sensor: tabs work with the arrow keys, and the drawing sheets zoom and switch', async () => {
  await withPage('#/p/sensor', {}, async page => {
    const first = page.getByRole('tab', {name: 'Pull it apart'});
    await first.focus();
    await page.keyboard.press('ArrowRight');
    assert.equal(await page.getByRole('tab', {name: 'Drawing sheets'}).getAttribute('aria-selected'), 'true');
    assert.equal(await page.locator('[role=tabpanel]').nth(0).isHidden(), true);
    const status = page.locator('.pan-tools .caption');
    await page.waitForFunction(() => /^\d+ percent$/.test(document.querySelector('.pan-tools .caption').textContent));
    const before = parseInt(await status.innerText(), 10);
    await page.getByRole('button', {name: 'Zoom in'}).click();
    assert.ok(parseInt(await status.innerText(), 10) > before);
    await page.getByRole('button', {name: 'Wall cleat and rail'}).click();
    assert.match(await page.locator('.pan img').getAttribute('src'), /mounting\.svg$/);
    await page.keyboard.press('Shift+Tab');
    await page.getByRole('tab', {name: 'Pull it apart'}).focus();
    await page.keyboard.press('ArrowLeft');
    assert.equal(await page.getByRole('tab', {name: 'Drawing sheets'}).getAttribute('aria-selected'), 'true', 'arrow keys wrap around');
  });
});

test('lamp: the named poses show the numbers from the evidence file', async () => {
  const evidence = json('data/lamp-evidence.json');
  await withPage('#/p/lamp', {}, async page => {
    for (const pose of evidence.motion.poses.filter(p => p.pose !== 'Return')) {
      await page.getByRole('button', {name: pose.pose, exact: true}).click();
      const readout = await page.locator('.readout').innerText();
      assert.ok(readout.includes(pose.pose), `${pose.pose}: pose name`);
      assert.ok(readout.includes(`${pose.frame} of 90`), `${pose.pose}: frame`);
      assert.ok(readout.includes(two(pose.forward_reach_bu)), `${pose.pose}: reach ${two(pose.forward_reach_bu)}`);
      assert.ok(readout.includes(two(pose.height_bu)), `${pose.pose}: height ${two(pose.height_bu)}`);
      assert.equal(await page.getByRole('slider').getAttribute('aria-valuetext'), `${pose.pose} pose, frame ${pose.frame} of 90`);
      assert.equal(await page.getByRole('button', {name: pose.pose, exact: true}).getAttribute('aria-pressed'), 'true');
    }
    await page.getByRole('slider').focus();
    await page.keyboard.press('ArrowRight');
    assert.match(await page.locator('.readout').innerText(), /Between named poses|Pose\s+\w+/);
  });
});

test('lamp: every frame the slider can show loads', async () => {
  await withPage('#/p/lamp', {}, async page => {
    const shown = await page.evaluate(async () => {
      const slider = document.querySelector('.scrub-controls input'), img = document.querySelector('.scrub-frame img'), seen = new Map();
      for (let v = 0; v <= 1000; v += 5) {
        slider.value = String(v); slider.dispatchEvent(new Event('input', {bubbles: true}));
        await img.decode().catch(() => {});
        seen.set(img.src, img.naturalWidth > 0);
      }
      return [...seen];
    });
    assert.equal(shown.length, 27, 'all 27 rendered frames are reachable');
    assert.ok(shown.every(([, ok]) => ok), 'every frame loads');
  });
});

test('ads: four ads with descriptions, two silent story videos with text equivalents', async () => {
  await withPage('#/p/ads', {}, async (page, log) => {
    const stills = page.locator('.media-grid img');
    assert.equal(await stills.count(), 4);
    for (const img of await stills.all()) assert.ok((await img.getAttribute('alt')).length > 40, 'meaningful alt text');
    const videos = page.locator('video');
    assert.equal(await videos.count(), 2);
    for (const video of await videos.all()) {
      assert.ok(await video.getAttribute('aria-describedby'));
      assert.equal(await video.getAttribute('autoplay'), null, 'no autoplay');
      const src = await video.locator('source').getAttribute('src');
      const response = await page.request.head(new URL(src, env.base).href);
      assert.equal(response.status(), 200);
      assert.match(response.headers()['content-type'], /video\/mp4/);
    }
    assert.deepEqual(log.bad, []);
  });
});

test('pcb: clicking a track lights its whole net, and the lists find nets and parts', async () => {
  await withPage('#/p/pcb', {}, async page => {
    const target = await page.evaluate(() => {
      const hits = [...document.querySelectorAll('.board-svg line.hit')];
      const longest = hits.reduce((a, b) => (b.getTotalLength?.() ?? 0) > (a.getTotalLength?.() ?? 0) ? b : a);
      const r = longest.getBoundingClientRect();
      return {x: r.x + r.width / 2, y: r.y + r.height / 2, net: longest.dataset.net};
    });
    await page.mouse.click(target.x, target.y);
    assert.equal(await page.locator('#pcb-net').inputValue(), target.net);
    assert.match(await page.locator('.pcb-info').innerText(), /^Net \S+\. \d+ pads? on \d+ parts?/);
    assert.ok(await page.locator('.board-svg .cu.on').count() > 1, 'copper on the net is lit');
    assert.ok(await page.locator('.board-svg.sel').count() === 1, 'the rest is dimmed');
    await page.getByRole('button', {name: 'Clear selection'}).click();
    assert.equal(await page.locator('.board-svg.sel').count(), 0);
    await page.selectOption('#pcb-part', 'U1');
    assert.match(await page.locator('.pcb-info').innerText(), /^U1 THVD1410DR/);
    assert.equal(await page.locator('.board-svg .pad.part-on').count(), 8);
    await page.getByLabel('Top copper').uncheck();
    assert.match(await page.locator('.board-svg').getAttribute('class'), /hide-l-top/);
  });
});

test('pcb: the viewer data agrees with the independent fabrication check', async () => {
  const facts = json('data/facts.json').pcb, view = json('data/pcb-view.json');
  const vias = facts.find(f => f.label === 'Vias and plated holes').value;
  assert.ok(vias.startsWith(`${view.vias.length} vias`), `viewer has ${view.vias.length} vias, check says "${vias}"`);
  const size = facts.find(f => f.label === 'Board').value;
  assert.ok(size.startsWith(`${view.bounds[2] - view.bounds[0]} × ${view.bounds[3] - view.bounds[1]} mm`), `board "${size}"`);
  assert.equal(view.bom.length, 47);
});

test('pcb: the bill of materials opens, and a part button selects that part', async () => {
  await withPage('#/p/pcb', {}, async page => {
    await page.getByText(/Bill of materials, \d+ lines/).click();
    assert.ok(await page.locator('.bom tbody tr').count() > 40);
    await page.getByRole('button', {name: 'Show J1 on the board'}).click();
    assert.equal(await page.locator('#pcb-part').inputValue(), 'J1');
    assert.equal(await page.getByRole('button', {name: 'Show J1 on the board'}).getAttribute('aria-pressed'), 'true');
  });
});

test('the figures on the home page and the project pages come from data/facts.json, each with its source file', async () => {
  const facts = json('data/facts.json');
  const {default: config} = await import('../site.config.js');
  const {projects} = await import('../assets/js/projects.js');
  await withPage('#/all', {}, async page => {
    const shown = await page.locator('.feature-stat .value').allInnerTexts();
    assert.deepEqual(shown, config.featured.filter(slug => facts[slug]?.length).map(slug => facts[slug][0].value));
  });
  for (const slug of ['sensor', 'lamp', 'ads', 'pcb'].filter(wanted)) {
    const repo = projects.find(p => p.slug === slug).repo;
    await withPage(`#/p/${slug}`, {}, async page => {
      const stats = page.locator('.stats .stat');
      assert.equal(await stats.count(), facts[slug].length, `${slug}: one stat per figure`);
      for (const [i, fact] of facts[slug].entries()) {
        assert.equal(await stats.nth(i).locator('dt').innerText(), fact.label);
        assert.equal(await stats.nth(i).locator('.value').innerText(), fact.value);
        if (fact.path) assert.ok((await stats.nth(i).locator('.source a').getAttribute('href')).endsWith(`/${repo}/blob/main/${fact.path}`), `${slug}: source of ${fact.label}`);
      }
    });
  }
});

test('atlas: the real app runs in the page, and the scenario switch shows what changes', async () => {
  await withPage('#/p/atlas', {}, async (page, log) => {
    const app = page.frameLocator('iframe');
    await app.getByRole('heading', {name: 'Flood Exposure Atlas', level: 1}).waitFor();
    assert.match(await app.locator('#count').innerText(), /^16 of 16 facilities shown\. All exposure levels, baseline\./);
    await app.locator('#scenario').selectOption({label: 'Expanded extent'});
    assert.match(await app.locator('#scenario-note').innerText(), /^\d+ of 16 facilities change exposure from baseline\./);
    await app.locator('#filter').selectOption({label: 'High'});
    assert.match(await app.locator('#count').innerText(), /^\d+ of 16 facilities shown\. High exposure, expanded extent\./);
    assert.deepEqual(log.errors, []);
    assert.deepEqual(log.outside, []);
  });
});

test('paint: the real app runs in the page and adds a room to the quote', async () => {
  await withPage('#/p/paint', {}, async (page, log) => {
    const app = page.frameLocator('iframe');
    await app.getByRole('heading', {name: 'Plan your next coat.', level: 1}).waitFor();
    const total = () => app.locator('.total').innerText();
    const before = await total();
    assert.match(await app.locator('#summary-note').innerText(), /^1 room\./);
    await app.getByRole('button', {name: 'Add room'}).click();
    await page.waitForFunction(() => document.querySelector('iframe').contentDocument.querySelector('#summary-note')?.textContent.startsWith('2 rooms'));
    assert.notEqual(await total(), before, 'the total changes when a room is added');
    assert.deepEqual(log.errors, []);
  });
});

test('embedded apps open on their own page too', async () => {
  for (const [slug, title] of [['atlas', /Flood Exposure Atlas/], ['paint', /Second Coat|Plan your next coat/]]) {
    await withPage(`#/p/${slug}`, {}, async page => {
      const href = await page.getByRole('link', {name: 'Open on its own page'}).getAttribute('href');
      const response = await page.request.get(new URL(href, env.base).href);
      assert.equal(response.status(), 200);
      assert.match(await response.text(), title);
    });
  }
});

test('kit: the page shows the same numbers the kit itself reports for the example', async () => {
  const kit = await import('../demos/kit/index.mjs');
  const example = readFileSync(new URL('../demos/kit/examples/messy.geojson', import.meta.url), 'utf8');
  const {report} = kit.cleanText(example, {precision: 6, nearMeters: 15});
  await withPage('#/p/kit', {}, async page => {
    const tally = await page.locator('.tally').innerText();
    for (const [label, value] of [['Features in', report.input], ['Kept', report.accepted], ['Rejected', report.rejected], ['Written out', report.output], ['Warnings', report.warnings.length]])
      assert.match(tally.replace(/\s+/g, ' '), new RegExp(`${label} ${value}\\b`), label);
    const rows = await page.locator('.issues tbody tr').count();
    assert.equal(rows, Math.min(200, report.issues.length + report.warnings.length));
    assert.match(await page.locator('.issues').innerText(), /duplicate_id/);
  });
});

test('kit: broken JSON is explained and the cursor is put where it breaks; bad options are refused', async () => {
  await withPage('#/p/kit', {}, async page => {
    await page.locator('#kit-input').fill('{"type":"FeatureCollection","features":[{"type":"Feature",,}]}');
    await page.getByRole('button', {name: 'Clean', exact: true}).click();
    assert.match(await page.locator('.status').innerText(), /line 1, column \d+/);
    assert.equal(await page.locator('.tally').isHidden(), true);
    assert.equal(await page.evaluate(() => document.activeElement.id), 'kit-input');
    await page.locator('#kit-input').fill('{"type":"FeatureCollection","features":[]}');
    await page.locator('#kit-precision').fill('12');
    await page.getByRole('button', {name: 'Clean', exact: true}).click();
    assert.match(await page.locator('.status').innerText(), /Decimal places must be a whole number from 0 to 8/);
    await page.locator('#kit-precision').fill('4');
    await page.getByRole('button', {name: 'Clean', exact: true}).click();
    assert.match(await page.locator('.status').innerText(), /0 of 0 features kept/);
    await page.getByRole('button', {name: 'Use the example'}).click();
    assert.match(await page.locator('#kit-input').inputValue(), /CLINIC-01/);
  });
});

test('kit: the cleaned file and the report can be downloaded', async () => {
  await withPage('#/p/kit', {}, async page => {
    const [cleaned] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', {name: 'Download cleaned file'}).click()]);
    assert.equal(cleaned.suggestedFilename(), 'cleaned.geojson');
    const [report] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', {name: 'Download report'}).click()]);
    assert.equal(report.suggestedFilename(), 'report.json');
    assert.equal(JSON.parse(readFileSync(await report.path(), 'utf8')).schemaVersion, 2);
  });
});

test('tracker: the recording has a step list that jumps in the video, and a contract tab from the OpenAPI file', async () => {
  const {steps} = json('data/tracker-steps.json'), api = json('data/tracker-api.json');
  await withPage('#/p/tracker', {}, async page => {
    const buttons = page.locator('.steps button');
    assert.equal(await buttons.count(), steps.length);
    await buttons.nth(4).click();
    await page.waitForFunction(at => document.querySelector('video').currentTime >= at - 0.2, steps[4].at, {timeout: 5000});
    await page.evaluate(() => document.querySelector('video').pause());
    assert.equal(await page.locator('video').getAttribute('aria-describedby'), 'rec-steps');
    assert.equal(await page.locator('video').getAttribute('autoplay'), null);
    await page.getByRole('tab', {name: 'API contract'}).click();
    assert.equal(await page.locator('.issues tbody tr').count(), api.operations.length);
    assert.match(await page.locator('.issues').innerText(), /POST\s+\/api\/login/);
    assert.match(await page.locator('pre.code').innerText(), /curl/);
  });
});

test('every project has a thumbnail, and every file the pages point at exists', async () => {
  const {projects} = await import('../assets/js/projects.js');
  const {existsSync} = await import('node:fs');
  for (const p of projects) {
    assert.ok(existsSync(new URL(`../${p.thumb}`, import.meta.url)), p.thumb);
    if (p.embed) assert.ok(existsSync(new URL(`../${p.embed}`, import.meta.url)), p.embed);
  }
});

test('on a phone, buttons, tabs and form controls are at least 24 by 24 pixels, and the main ones 44 pixels tall', async () => {
  const context = await env.browser.newContext({viewport: {width: 360, height: 740}, hasTouch: true, isMobile: true, reducedMotion: 'reduce'});
  try {
    for (const slug of ['sensor', 'lamp', 'pcb', 'kit', 'tracker']) {
      const page = await context.newPage();
      await page.goto(`${env.base}#/p/${slug}`, {waitUntil: 'load'});
      await page.waitForFunction(() => !document.querySelector('main[aria-busy]'));
      if (slug === 'pcb') await page.getByText(/Bill of materials/).click();
      const small = await page.evaluate(() => [...document.querySelectorAll('button, [role=tab], select, input:not([type=file]):not([type=range]), summary')]
        .filter(el => el.checkVisibility() && !el.closest('.sr'))
        .map(el => { const r = el.getBoundingClientRect(); return {el: `${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''} "${(el.textContent || el.getAttribute('aria-label') || '').trim().slice(0, 24)}"`, w: Math.round(r.width), h: Math.round(r.height)}; })
        .filter(r => r.w < 24 || r.h < 24));
      assert.deepEqual(small, [], `${slug}: controls smaller than 24 by 24 pixels`);
      await page.close();
    }
  } finally { await context.close(); }
});

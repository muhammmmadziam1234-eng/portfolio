import {test, before, after} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {launch, open, wanted} from './helpers.mjs';

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
    assert.match(await page.locator('.scrub-frame img').getAttribute('src'), /explode-13\.jpg$/);
    assert.match(await page.locator('.scrub-frame img').getAttribute('alt'), /fully exploded/);
    await page.keyboard.press('Home');
    assert.equal(await range.getAttribute('aria-valuetext'), 'Assembled');
    assert.match(await page.locator('.scrub-frame img').getAttribute('src'), /explode-00\.jpg$/);
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

test('the overview table shows figures that come from data/facts.json', async () => {
  const facts = json('data/facts.json');
  await withPage('#/all', {}, async page => {
    for (const slug of ['sensor', 'lamp', 'ads', 'pcb'].filter(wanted)) {
      const lines = facts[slug].filter(f => f.line).slice(0, 2).map(f => f.line);
      const text = await page.locator('.register tbody').innerText();
      for (const line of lines) assert.ok(text.includes(line), `${slug}: ${line}`);
    }
  });
});

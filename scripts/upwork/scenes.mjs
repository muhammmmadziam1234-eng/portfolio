// One scene per project. Each is a short, silent walk through what a visitor can do, with captions.
// A scene gets the page, helpers (say, click, type, drag, glide, centre, go) and the base address.
// Scenes run in tour order, and the combined tour has to stay under 60 seconds.
const toTop = (page, selector) => page.evaluate(s => document.querySelector(s).scrollIntoView({block: 'start', behavior: 'instant'}), selector);
// An app in a frame is made short enough to sit above the caption bar, so nothing a scene clicks is hidden behind it.
const fitFrame = async page => {
  await page.evaluate(() => { const f = document.querySelector('iframe'); f.style.height = '640px'; f.style.minHeight = '0'; });
  await toTop(page, 'iframe');
};

export const scenes = {
  sensor: {
    async run(page, {say, centre, click, drag}) {
      await say('Pull a 3D-modelled sensor apart', 500);
      const [x, y] = await centre(page.getByRole('slider').first());
      await drag(x - 330, y, x + 330, 2400);
      await say('Then open its drawing sheets, measured from the model', 400);
      await click(page.getByRole('tab', {name: 'Drawing sheets'}), 800);
      await click(page.getByRole('button', {name: 'Zoom in'}), 500);
      await click(page.getByRole('button', {name: 'Zoom in'}), 1100);
    }
  },
  lamp: {
    async run(page, {say, click}) {
      await say('Move a lamp through its named poses', 400);
      for (const pose of ['Raised', 'Forward', 'Lowered']) await click(page.getByRole('button', {name: pose, exact: true}), 1000);
    }
  },
  ads: {
    async run(page, {say}) {
      await say('Ads and silent story videos, composed in Python', 700);
      await page.mouse.wheel(0, 380); await page.waitForTimeout(1500);
    }
  },
  pcb: {
    async run(page, {say, glide}) {
      await say('Click a track on a four-layer board to light its whole net', 700);
      const spot = await page.evaluate(() => {
        const hits = [...document.querySelectorAll('.board-svg line.hit')];
        const longest = hits.reduce((a, b) => (b.getTotalLength?.() ?? 0) > (a.getTotalLength?.() ?? 0) ? b : a);
        const r = longest.getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2];
      });
      await glide(spot[0], spot[1], 30); await page.mouse.click(spot[0], spot[1]); await page.waitForTimeout(1700);
      await say('Or pick a part and see it framed on the board', 300);
      await page.selectOption('#pcb-part', 'U1'); await page.waitForTimeout(2000);
    }
  },
  atlas: {
    zoom: 1,
    async run(page, {say, centre, glide, click}) {
      const app = page.frameLocator('iframe');
      await app.locator('#scenario').waitFor();
      await fitFrame(page);
      await app.locator('#scenario').evaluate(el => el.scrollIntoView({block: 'start', behavior: 'instant'}));
      await say('Switch the flood scenario and see which facilities change', 800);
      const [x, y] = await centre(app.locator('#scenario'));
      await glide(x, y, 20);
      await app.locator('#scenario').selectOption({label: 'Expanded extent'});
      await page.waitForTimeout(1700);
      await say('Filter by exposure level', 300);
      const [fx, fy] = await centre(app.locator('#filter'));
      await glide(fx, fy, 16);
      await app.locator('#filter').selectOption({label: 'High'});
      await page.waitForTimeout(1200);
      await click(app.getByRole('button', {name: /^Harbour Clinic/}).first(), 1500);
    }
  },
  kit: {
    async run(page, {say, click}) {
      await toTop(page, '.exhibit');
      await say('Clean a messy GeoJSON file', 1100);
      await page.evaluate(() => document.querySelector('.issues').scrollIntoView({block: 'center', behavior: 'instant'}));
      await say('Every rejected record gets a rule name and what to do about it', 2800);
      await toTop(page, '.exhibit');
      await page.locator('#kit-precision').fill('3');
      await click(page.getByRole('button', {name: 'Clean', exact: true}), 600);
      await say('Change an option and run it again', 1500);
    }
  },
  tracker: {
    // The service desk is already recorded by scripts/record-tracker.mjs. The tour uses its last part, the one that is hardest to describe.
    existing: 'tracker'
  },
  paint: {
    zoom: 1,
    async run(page, {say, click, type}) {
      const app = page.frameLocator('iframe');
      await app.getByRole('button', {name: 'Add room'}).waitFor();
      await fitFrame(page);
      await say('Build a quote room by room', 700);
      await click(app.getByRole('button', {name: 'Add room'}), 600);
      await type(app.getByLabel('Length (m)').nth(1), '4.2', 200);
      await type(app.getByLabel('Width (m)').nth(1), '3.6', 200);
      await type(app.getByLabel('Height (m)').nth(1), '2.5', 700);
      await say('The estimate updates as you type', 1600);
      await click(app.getByText('Imperial (ft, in)'), 700);
      await say('Switch to feet and inches', 1600);
    }
  }
};

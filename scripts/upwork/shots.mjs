// The states worth a still picture. Each function puts one demo into a state and returns; plates.mjs takes the picture.
export const shots = {
  sensor: [
    async page => { const r = page.getByRole('slider').first(); await r.focus(); await page.keyboard.press('End'); },
    async page => { await page.getByRole('tab', {name: 'Drawing sheets'}).click(); await page.waitForTimeout(400); await page.getByRole('button', {name: 'Zoom in'}).click(); }
  ],
  lamp: [
    async page => { await page.getByRole('button', {name: 'Raised', exact: true}).click(); },
    async page => { await page.getByRole('button', {name: 'Lowered', exact: true}).click(); }
  ],
  ads: [async () => {}],
  pcb: [
    async page => {
      const spot = await page.evaluate(() => {
        const hits = [...document.querySelectorAll('.board-svg line.hit')];
        const longest = hits.reduce((a, b) => (b.getTotalLength?.() ?? 0) > (a.getTotalLength?.() ?? 0) ? b : a);
        const r = longest.getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2];
      });
      await page.mouse.click(spot[0], spot[1]);
    },
    async page => { await page.selectOption('#pcb-part', 'U1'); }
  ],
  atlas: [
    async page => {
      const app = page.frameLocator('iframe');
      await app.locator('#scenario').selectOption({label: 'Expanded extent'});
      await app.locator('#scenario').evaluate(el => el.scrollIntoView({block: 'start', behavior: 'instant'}));
    },
    async page => { const app = page.frameLocator('iframe'); await app.locator('#filter').selectOption({label: 'High'}); }
  ],
  kit: [
    async page => { await page.locator('.issues').evaluate(el => { el.scrollTop = 0; }); },
    async page => { await page.locator('#kit-precision').fill('3'); await page.getByRole('button', {name: 'Clean', exact: true}).click(); }
  ],
  tracker: [
    async page => { await page.evaluate(() => { const v = document.querySelector('video'); v.currentTime = 20; }); await page.waitForTimeout(600); },
    async page => { await page.getByRole('tab', {name: 'API contract'}).click(); }
  ],
  paint: [
    async () => {},
    async page => { const app = page.frameLocator('iframe'); await app.getByRole('button', {name: 'Add room'}).click(); await app.getByLabel('Length (m)').nth(1).fill('4.2'); await app.getByLabel('Width (m)').nth(1).fill('3.6'); await app.getByLabel('Height (m)').nth(1).fill('2.5'); }
  ]
};

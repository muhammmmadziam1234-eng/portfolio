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
  ]
};

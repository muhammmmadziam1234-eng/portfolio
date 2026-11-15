// One scene per project. Each is a short, silent walk through what a visitor can do, with captions.
// A scene gets the page, small helpers (say, click, drag, glide, go) and the base address.
// Scenes run in tour order, and the combined tour has to stay under 60 seconds.
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
      await say('Move a lamp through its checked poses', 400);
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
  }
};

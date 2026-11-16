// Shared by the recorders: a caption bar and a visible pointer drawn inside the page, so they appear in the video,
// and small helpers for moving and clicking like a person would.

/** Runs inside the page (pass it to addInitScript with {zoom}). */
export function overlay({zoom = 1} = {}) {
  // Styles are set through the CSS object model, not a <style> element or a style attribute, so the overlay also works
  // on pages with a strict Content-Security-Policy (the service desk page allows no inline styles).
  const ready = () => {
    if (document.getElementById('rec-caption')) return;
    if (zoom !== 1) document.documentElement.style.zoom = String(zoom);   // fits a whole demo above the caption bar in a 1280 by 720 frame
    const caption = Object.assign(document.createElement('div'), {id: 'rec-caption'});
    const dot = Object.assign(document.createElement('div'), {id: 'rec-dot'});
    Object.assign(caption.style, {position: 'fixed', left: '0', right: '0', bottom: '0', zIndex: '2147483646', padding: '16px 36px 18px', background: 'rgba(20,28,34,.92)', color: '#fff',
      font: '600 30px/1.25 Archivo, Arial, sans-serif', letterSpacing: '-0.005em', display: 'none'});
    Object.assign(dot.style, {position: 'fixed', zIndex: '2147483647', width: '22px', height: '22px', margin: '-11px 0 0 -11px', borderRadius: '50%', background: 'rgba(255,243,161,.85)',
      border: '2px solid #14382b', pointerEvents: 'none', left: '-40px', top: '-40px', transition: 'transform .12s'});
    document.body.append(caption, dot);
    new MutationObserver(() => { caption.style.display = caption.textContent ? 'block' : 'none'; }).observe(caption, {childList: true, characterData: true, subtree: true});
    addEventListener('mousemove', e => { dot.style.left = e.clientX / zoom + 'px'; dot.style.top = e.clientY / zoom + 'px'; }, true);
    addEventListener('mousedown', () => { dot.style.transform = 'scale(.7)'; }, true);
    addEventListener('mouseup', () => { dot.style.transform = 'none'; }, true);
  };
  if (document.readyState === 'loading') addEventListener('DOMContentLoaded', ready); else ready();
}

export function tools(page) {
  const say = async (text, ms) => { await page.evaluate(t => { const c = document.getElementById('rec-caption'); if (c) c.textContent = t; }, text); await page.waitForTimeout(ms); };
  const centre = async locator => { const b = await locator.boundingBox(); return [b.x + b.width / 2, b.y + b.height / 2]; };
  return {
    say, centre,
    glide: (x, y, steps = 24) => page.mouse.move(x, y, {steps}),
    click: async (locator, pause = 700) => { await locator.evaluate(el => el.scrollIntoView({block: 'center', inline: 'nearest', behavior: 'instant'})); await page.waitForTimeout(120); const [x, y] = await centre(locator); await page.mouse.move(x, y, {steps: 16}); await page.mouse.click(x, y); await page.waitForTimeout(pause); },
    type: async (locator, text, pause = 400) => { await locator.click(); await locator.fill(''); await locator.pressSequentially(text, {delay: 55}); await page.waitForTimeout(pause); },
    drag: async (x1, y, x2, ms = 2200) => {
      await page.mouse.move(x1, y, {steps: 14}); await page.mouse.down();
      const n = 20; for (let i = 1; i <= n; i++) { await page.mouse.move(x1 + (x2 - x1) * i / n, y); await page.waitForTimeout(ms / n); }
      await page.mouse.up();
    }
  };
}

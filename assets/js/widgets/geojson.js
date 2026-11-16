import {h, download} from '../util.js';

const MAX_ROWS = 200;

/**
 * The GeoJSON Quality Kit running in the page. It imports the kit's own index.mjs, copied unchanged into demos/kit,
 * and calls cleanText, the same function the command line uses for a string.
 */
export default async function geojson(root) {
  const kit = await import('../../../demos/kit/index.mjs');
  const example = await (await fetch('demos/kit/examples/messy.geojson')).text();

  const input = h('textarea', {id: 'kit-input', spellcheck: 'false', autocomplete: 'off', 'aria-describedby': 'kit-hint', rows: '18'});
  input.value = example;
  const precision = h('input', {id: 'kit-precision', type: 'number', min: '0', max: '8', step: '1', value: '6', inputmode: 'numeric'});
  const near = h('input', {id: 'kit-near', type: 'number', min: '0', max: '1000', step: '1', value: '15', inputmode: 'numeric'});
  const status = h('p', {class: 'status', role: 'status'}, 'Press Clean to run the kit on the text on the left.');
  const file = h('input', {id: 'kit-file', type: 'file', accept: '.geojson,.json,application/geo+json,application/json', class: 'sr'});
  const cleanButton = h('button', {class: 'btn', type: 'button'}, 'Clean');
  const exampleButton = h('button', {class: 'btn secondary', type: 'button'}, 'Use the example');
  const chooseButton = h('label', {class: 'btn secondary', for: 'kit-file'}, 'Open a file');

  const tally = h('dl', {class: 'tally', hidden: true});
  const issues = h('div', {class: 'issues', tabindex: '0', role: 'region', 'aria-label': 'Issues found', hidden: true});
  const output = h('pre', {class: 'code output', tabindex: '0', 'aria-label': 'Cleaned GeoJSON', hidden: true});
  const saveCleaned = h('button', {class: 'btn secondary small', type: 'button', hidden: true}, 'Download cleaned file');
  const saveReport = h('button', {class: 'btn secondary small', type: 'button', hidden: true}, 'Download report');
  let last = null;

  const say = (text, bad = false) => { status.textContent = text; status.classList.toggle('bad', bad); };
  const stat = (label, value) => h('div', {}, h('dt', {}, label), h('dd', {}, String(value)));

  function run() {
    const digits = Number(precision.value), metres = Number(near.value);
    if (!Number.isInteger(digits) || digits < 0 || digits > 8) { say('Decimal places must be a whole number from 0 to 8.', true); precision.focus(); return; }
    if (!Number.isFinite(metres) || metres < 0 || metres > 1000) { say('Near-duplicate distance must be from 0 to 1000 metres. Use 0 to turn the check off.', true); near.focus(); return; }
    let result;
    try { result = kit.cleanText(input.value, {precision: digits, nearMeters: metres}); }
    catch (error) { say(error.message, true); return; }
    if ('error' in result) {
      const at = result.error.offset;
      say(result.error.message, true);
      for (const el of [tally, issues, output, saveCleaned, saveReport]) el.hidden = true;
      input.focus();
      if (Number.isInteger(at)) input.setSelectionRange(at, Math.min(at + 1, input.value.length));
      return;
    }
    const {report, cleaned} = result;
    last = {report, cleaned};
    const rows = [...report.issues, ...report.warnings];
    tally.replaceChildren(stat('Features in', report.input), stat('Kept', report.accepted), stat('Rejected', report.rejected), stat('Written out', report.output), stat('Warnings', report.warnings.length));
    tally.hidden = false;
    issues.replaceChildren(rows.length
      ? h('table', {},
          h('caption', {class: 'sr'}, 'Issues found, errors first'),
          h('thead', {}, h('tr', {}, ['Feature', 'Id', 'Rule', 'What happened and what to do'].map(t => h('th', {scope: 'col'}, t)))),
          h('tbody', {}, rows.slice(0, MAX_ROWS).map(r => h('tr', {},
            h('td', {class: 'num'}, String(r.index)), h('td', {}, r.id ?? '(none)'),
            h('td', {}, h('code', {}, r.code), r.severity === 'warning' ? ' (warning)' : ''), h('td', {}, r.message)))))
      : h('p', {class: 'caption'}, 'No issues found.'));
    if (rows.length > MAX_ROWS) issues.append(h('p', {class: 'caption'}, `Showing the first ${MAX_ROWS} of ${rows.length}. The report file lists them all.`));
    issues.hidden = false;
    output.textContent = JSON.stringify(cleaned, null, 2);
    output.hidden = false; saveCleaned.hidden = false; saveReport.hidden = false;
    say(`${report.accepted} of ${report.input} features kept, ${report.rejected} rejected, ${report.warnings.length} warning${report.warnings.length === 1 ? '' : 's'}. Nothing left this page.`);
  }

  cleanButton.addEventListener('click', run);
  exampleButton.addEventListener('click', () => { input.value = example; say('The example is back. Press Clean.'); });
  file.addEventListener('change', async () => {
    const chosen = file.files?.[0];
    if (!chosen) return;
    if (chosen.size > 5 * 1024 * 1024) { say(`${chosen.name} is ${(chosen.size / 1048576).toFixed(1)} MB. This page takes files up to 5 MB; the command line handles larger ones.`, true); return; }
    input.value = await chosen.text();
    say(`${chosen.name} loaded. Press Clean.`);
    file.value = '';
  });
  saveCleaned.addEventListener('click', () => last && download('cleaned.geojson', JSON.stringify(last.cleaned, null, 2), 'application/geo+json'));
  saveReport.addEventListener('click', () => last && download('report.json', JSON.stringify(last.report, null, 2)));

  root.append(h('div', {class: 'play'},
    h('section', {'aria-label': 'Input'},
      h('label', {for: 'kit-input'}, 'GeoJSON to clean'),
      input,
      h('p', {id: 'kit-hint', class: 'caption'}, 'The example is a made-up file with one problem of most kinds. Paste your own, or open a file. It is read in this page and goes nowhere else.'),
      h('div', {class: 'opts'},
        h('label', {for: 'kit-precision'}, 'Decimal places', precision), h('label', {for: 'kit-near'}, 'Flag points closer than (metres)', near),
        cleanButton, exampleButton, chooseButton, file),
      status),
    h('section', {'aria-label': 'Result'}, tally, h('div', {class: 'opts'}, saveCleaned, saveReport), output),
    issues));
  run();
  return {destroy() {}};
}

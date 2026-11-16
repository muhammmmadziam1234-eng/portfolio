#!/usr/bin/env node
// Reads each project's own evidence files and writes the numbers this site shows, plus the commit each copy came from.
// Nothing on the site states a figure that this script did not read out of a file in the project's repository.
//
// usage: node scripts/sync.mjs [--repos <folder holding the project checkouts>] [--only sensor,lamp] [--strict]
//   --strict   stop if a checkout has uncommitted changes (use before publishing)
import {execFileSync} from 'node:child_process';
import {copyFileSync, cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync} from 'node:fs';
import {dirname, join, relative, resolve, sep} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {projects} from '../assets/js/projects.js';

const site = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const option = (name, fallback) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : fallback; };
const reposDir = resolve(option('repos', resolve(site, '..')));
const only = (option('only', '') || '').split(',').filter(Boolean);
const strict = args.includes('--strict');
const num = n => Number(n).toLocaleString('en-GB');
const problems = [];
// Not part of a demo's running app: tests, tooling, docs and evidence stay in the repository.
const demoSkip = new Set(['.git', '.github', 'node_modules', 'test', 'e2e', 'validation', 'scripts', 'docs', 'package.json', 'package-lock.json', 'tsconfig.json', 'README.md', 'benchmark.mjs', 'analyze.mjs', 'serve.mjs', 'exposure.geojson']);

function openRepo(name) {
  const dir = join(reposDir, name);
  if (!existsSync(dir)) throw new Error(`${name} is not checked out in ${reposDir}`);
  const git = (...a) => execFileSync('git', ['-C', dir, ...a], {encoding: 'utf8'}).trim();
  const used = new Set();
  const repo = {
    name, dir, commit: git('rev-parse', 'HEAD'), dirty: git('status', '--porcelain') !== '', used,
    has: path => existsSync(join(dir, path)),
    text(path) { used.add(path); return readFileSync(join(dir, path), 'utf8'); },
    json(path) { return JSON.parse(repo.text(path)); },
    size(path) { return statSync(join(dir, path)).size; },
    list(path) { return readdirSync(join(dir, path)).sort(); },
    /** Copy a file or folder into the site and count the files. */
    copy(from, to, filter = () => true) {
      const target = join(site, to);
      rmSync(target, {recursive: true, force: true});
      mkdirSync(dirname(target), {recursive: true});
      if (statSync(join(dir, from)).isDirectory()) {
        cpSync(join(dir, from), target, {recursive: true, filter: src => filter(relative(join(dir, from), src))});
        const walk = d => readdirSync(d, {withFileTypes: true}).flatMap(e => e.isDirectory() ? walk(join(d, e.name)) : [join(d, e.name)]);
        for (const file of walk(target)) used.add(join(from, relative(target, file)));
      } else { copyFileSync(join(dir, from), target); used.add(from); }
    }
  };
  if (repo.dirty) {
    if (strict) problems.push(`${name} has uncommitted changes`);
    else console.warn(`${name} has uncommitted changes (continuing; use --strict before publishing)`);
  }
  return repo;
}

const pngSize = file => { const b = readFileSync(file); return [b.readUInt32BE(16), b.readUInt32BE(20)]; };
const probe = file => JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height,nb_read_frames:format=duration', '-count_frames', '-of', 'json', file], {encoding: 'utf8'}));

// One extractor per project. Each returns the facts shown beside the demo:
// {label, value, line (one sentence for the overview table), path (the file in the repository that holds it)}.
const extractors = {
  sensor(repo) {
    const path = 'handoff/measurements.json', m = repo.json(path);
    const {envelope: e, vent_and_feedthrough: v, seal: s, mount: t} = m;
    return [
      {label: 'Case size', value: `${e.width} × ${e.height} × ${e.body_depth} mm`, path,
        line: `Dimensions on the sheets are read from the model: case ${e.width} × ${e.height} mm, ${v.slot_count} grille slots.`},
      {label: 'Gasket squeeze at nominal', value: `${s.nominal_squeeze_percent}%`, path,
        line: `Gasket squeeze is ${s.nominal_squeeze_percent}% at nominal: ${s.free_height} mm pressed to ${s.seat_to_land} mm.`},
      {label: 'Upward shift to clear the wall cleat flanges (latch already released)', value: `${t.upward_slide_to_clear_flange} mm`, path, line: `The case shifts up ${t.upward_slide_to_clear_flange} mm to clear the wall cleat flanges, with the latch already released.`},
      {label: 'Grille slots', value: `${v.slot_count}, each ${v.slot_width} mm wide`, path, line: `${v.slot_count} grille slots.`}
    ];
  },
  lamp(repo) {
    repo.copy('articulation-evidence.json', 'data/lamp-evidence.json');
    const path = 'articulation-evidence.json', d = repo.json(path), r = d.sampled_ranges, m = d.motion;
    const range = ([lo, hi]) => `${lo.toFixed(2).replace('-', '−')} to ${hi.toFixed(2)}`;
    return [
      {label: 'Joint combinations evaluated', value: num(d.grid_pose_count), path, line: `${num(d.grid_pose_count)} joint combinations evaluated across all three limits.`},
      {label: 'Motion frames checked', value: `${m.verified_frames_including_loop_key}`, path,
        line: `All ${m.verified_frames_including_loop_key} frames of the motion checked for camera framing and cable fit.`},
      {label: 'Forward reach over the grid, Blender units', value: range(r.forward_reach_bu), path, line: `Reach spans ${range(r.forward_reach_bu)} Blender units.`},
      {label: 'Height over the grid, Blender units', value: range(r.height_bu), path, line: `Height spans ${range(r.height_bu)} Blender units.`},
      {label: 'Largest gap between cable and anchor', value: `${m.maximum_cable_anchor_to_surface_bu.toFixed(2)} Blender units`, path, line: ''}
    ];
  },
  ads(repo) {
    const files = repo.list('exports');
    for (const f of files) repo.used.add(`exports/${f}`);
    const images = files.filter(f => f.endsWith('.png')), videos = files.filter(f => f.endsWith('.mp4'));
    const sizes = [...new Set(files.filter(f => /-(square|vertical)\.png$/.test(f)).map(f => pngSize(join(repo.dir, 'exports', f)).join(' × ')))];
    const clips = videos.map(f => probe(join(repo.dir, 'exports', f)));
    const length = [...new Set(clips.map(c => Number(c.format.duration).toFixed(1)))];
    const frames = [...new Set(clips.map(c => c.streams[0].nb_read_frames))];
    const dims = [...new Set(clips.map(c => `${c.streams[0].width} × ${c.streams[0].height}`))];
    repo.used.add('.github/workflows/render.yml');
    return [
      {label: 'Files exported', value: `${images.length} images, ${videos.length} videos`, path: '.github/workflows/render.yml',
        line: `All ${files.length} files are exported again on every push, and the ad sizes and video lengths are checked.`},
      {label: 'Ad sizes', value: sizes.join(' and ') + ' pixels', path: '.github/workflows/render.yml', line: `Ads are ${sizes.join(' and ')} pixels.`},
      {label: 'Story videos', value: `${length.join(', ')} s, ${dims.join(', ')}, ${frames.join(', ')} frames`, path: 'render_stories.py', line: ''}
    ];
  },
  atlas(repo) {
    const e = 'docs/evidence/', cc = repo.json(e + 'crosscheck.json'), bm = repo.json(e + 'benchmark.json'), mu = repo.json(e + 'crosscheck-mutants.json');
    const ax = repo.json(e + 'accessibility.json'), cov = repo.text(e + 'coverage.txt');
    repo.copy('.', 'demos/atlas', rel => !demoSkip.has(rel.split(sep)[0]) || rel === '');
    const lines = file => Number(cov.match(new RegExp(`^${file.replace('.', '\\.')}\\s*\\|\\s*([\\d.]+)`, 'm'))?.[1]);
    const caught = mu.mutants.filter(m => m.caught).length, big = bm.scene, run = bm.indexedFullRun, direct = bm.directScanSubset;
    return [
      {label: 'Cross-check against Shapely', value: `${num(cc.pairs)} point-and-zone pairs, ${cc.disagreements} disagreements`, path: e + 'crosscheck.json',
        line: `Checked against Shapely on ${num(cc.pairs)} point-and-polygon pairs: ${cc.disagreements} disagreements.`},
      {label: 'Large run', value: `${num(big.points)} facilities against ${num(big.polygons)} zones in ${run.medianMs} ms`, path: e + 'benchmark.json',
        line: `${num(big.points)} facilities classified against ${num(big.polygons)} zones in ${run.medianMs} ms (median of ${run.runs} runs on one recorded machine).`},
      {label: 'Grid index against a direct scan, on a sample', value: `${Math.round(direct.gridSpeedupAtMedian)} times faster on ${num(direct.points)} points, identical results: ${direct.identicalResults ? 'yes' : 'no'}`, path: e + 'benchmark.json', line: ''},
      {label: 'Broken copies of the engine caught', value: `${caught} of ${mu.mutants.length}`, path: e + 'crosscheck-mutants.json', line: ''},
      {label: 'Line coverage of the engine and the import checks', value: `${lines('geo.mjs')}% and ${lines('validate.mjs')}%`, path: e + 'coverage.txt', line: ''},
      {label: 'Accessibility scan (axe-core)', value: `${ax.views.reduce((n, v) => n + v.violations, 0)} violations in ${ax.views.length} views`, path: e + 'accessibility.json', line: ''}
    ];
  },
  paint(repo) {
    const e = 'docs/evidence/', lh = repo.json(e + 'lighthouse.json'), ax = repo.json(e + 'axe.json'), pr = repo.json(e + 'print.json'), t = repo.json(e + 'tests.json'), cov = repo.text(e + 'coverage.txt');
    repo.copy('.', 'demos/paint', rel => !demoSkip.has(rel.split(sep)[0]) || rel === '');
    const lines = file => Number(cov.match(new RegExp(`^${file.replace('.', '\\.')}\\s*\\|\\s*([\\d.]+)`, 'm'))?.[1]);
    const sc = lh.medianScores;
    return [
      {label: 'Lighthouse (simulated phone)', value: `${sc.performance} performance, ${sc.accessibility} accessibility, ${sc['best-practices']} best practices, ${sc.seo} SEO`, path: e + 'lighthouse.json',
        line: `Lighthouse on a simulated phone: ${sc.performance}, ${sc.accessibility}, ${sc['best-practices']} and ${sc.seo} for performance, accessibility, best practices and SEO.`},
      {label: 'Tests', value: `${t.unit.pass} unit and ${t.e2e.pass} browser tests pass`, path: e + 'tests.json',
        line: `${t.unit.pass} unit and ${t.e2e.pass} browser tests pass; the pricing engine has ${lines('quote.mjs')}% line coverage.`},
      {label: 'Accessibility scan (axe-core)', value: `${ax.scenarios.reduce((n, s) => n + s.violations, 0)} violations in ${ax.scenarios.length} scenarios, print view included`, path: e + 'axe.json', line: ''},
      {label: 'Printed quote', value: `${pr.typicalQuote.rooms} rooms on ${pr.typicalQuote.pages} A4 page; ${pr.largestQuote.rooms} rooms with every option take ${pr.largestQuote.pages}`, path: e + 'print.json', line: ''}
    ];
  },
  async kit(repo) {
    const e = 'docs/evidence/', bm = repo.json(e + 'benchmark.json'), cov = repo.text(e + 'coverage.txt'), atlas = repo.text(e + 'atlas-check.txt');
    // Only the files that run in a browser. The command line and the streaming reader use Node's own modules and stay in the repository.
    rmSync(join(site, 'demos/kit'), {recursive: true, force: true});
    for (const file of ['index.mjs', 'quality.mjs', 'lib', 'examples/messy.geojson']) repo.copy(file, `demos/kit/${file}`);
    const tests = cov.match(/tests (\d+), pass (\d+), fail (\d+), skipped (\d+); line coverage ([\d.]+)%/);
    const kept = {features: 0, accepted: 0}, raw = {features: 0, accepted: 0};
    for (const line of atlas.split('\n')) {
      const m = line.match(/^(?:facilities|zones) (after the kit|straight from the raw file).*: (\d+) features, (\d+) accepted/);
      if (m) { const t = m[1] === 'after the kit' ? kept : raw; t.features += Number(m[2]); t.accepted += Number(m[3]); }
    }
    const {ISSUE_CODES} = await import(pathToFileURL(join(repo.dir, 'index.mjs')).href);
    return [
      {label: 'Large file, streamed', value: `${num(bm.data.records)} records (${bm.data.fileMB} MB) in ${bm.pipeline.seconds} s, ${bm.pipeline.peakRssMB} MB of memory`, path: e + 'benchmark.json',
        line: `Streams ${num(bm.data.records)} records (${bm.data.fileMB} MB) in ${bm.pipeline.seconds} s using ${bm.pipeline.peakRssMB} MB of memory (one recorded machine).`},
      {label: "Output accepted by the flood atlas's own validator", value: `${kept.accepted} of ${kept.features} features, against ${raw.accepted} of ${raw.features} before cleaning`, path: e + 'atlas-check.txt',
        line: `Cleaned output is accepted by the flood atlas's own validator: ${kept.accepted} of ${kept.features} features, against ${raw.accepted} of ${raw.features} before cleaning.`},
      {label: 'Tests and line coverage', value: `${tests[1]} tests (${tests[4]} skipped while measuring), ${tests[5]}% of lines`, path: e + 'coverage.txt', line: ''},
      {label: 'Rule codes with a stable name and a fix', value: `${Object.keys(ISSUE_CODES).length}`, path: 'lib/codes.mjs', line: ''}
    ];
  },
  tracker(repo) {
    const e = 'docs/evidence/', cov = repo.text(e + 'coverage.txt'), e2e = repo.text(e + 'e2e.txt'), audit = repo.text(e + 'audit.txt'), api = repo.json('openapi.json'), pkg = repo.json('package.json');
    repo.copy(e + 'curl-session.txt', 'data/tracker-curl.txt');
    // The API panel lists the operations a client would call, read from the OpenAPI file; the static page routes are left out.
    const operations = [];
    for (const [path, item] of Object.entries(api.paths)) {
      for (const [method, op] of Object.entries(item)) {
        if (!['get', 'post', 'put', 'patch', 'delete'].includes(method)) continue;
        if (!(path.startsWith('/api/') || ['/healthz', '/readyz', '/openapi.json'].includes(path))) continue;
        const needs = Object.keys(op.security?.[0] ?? {});
        operations.push({method: method.toUpperCase(), path, summary: op.summary, needs: needs.includes('csrfToken') ? 'Session and CSRF token' : needs.includes('sessionCookie') ? 'Session' : 'Nothing'});
      }
    }
    writeFileSync(join(site, 'data/tracker-api.json'), JSON.stringify({openapi: api.openapi, title: api.info.title, version: api.info.version, operations}, null, 2) + '\n');
    const total = Object.values(api.paths).reduce((n, item) => n + Object.keys(item).filter(m => ['get', 'post', 'put', 'patch', 'delete'].includes(m)).length, 0);
    const tests = cov.match(/Tests: (\d+) run, (\d+) passed, (\d+) failed/), line = cov.match(/Line coverage ([\d.]+)% of code lines against a gate of (\d+)%/);
    const contract = Number(cov.match(/total contract: (\d+)/)?.[1]), browser = e2e.match(/tests (\d+)\s+\S*\s*pass (\d+)/);
    const vulns = audit.match(/found (\d+) vulnerabilit/), deps = Object.keys(pkg.dependencies ?? {}).length;
    if (!tests || !line || !contract || !browser || !vulns) throw new Error('A figure was not found in the tracker evidence files; their format may have changed.');
    return [
      {label: 'Tests', value: `${tests[2]} pass, plus ${browser[2]} browser tests`, path: e + 'coverage.txt',
        line: `${tests[2]} tests and ${browser[2]} browser tests pass; ${line[1]}% of the code is covered (gate ${line[2]}%).`},
      {label: 'API contract', value: `OpenAPI ${api.openapi}, ${total} operations, ${contract} contract tests`, path: 'openapi.json',
        line: `Described in OpenAPI ${api.openapi} (${total} operations); ${contract} contract tests check the running server against it.`},
      {label: 'Line coverage of src/', value: `${line[1]}% of code lines, gate ${line[2]}%`, path: e + 'coverage.txt', line: ''},
      {label: 'Known vulnerabilities in what ships (npm audit)', value: vulns[1], path: e + 'audit.txt', line: ''},
      {label: 'Runtime dependencies', value: String(deps), path: 'package.json', line: ''}
    ];
  },
  pcb(repo) {
    const check = repo.json('reports/independent-fabrication-check.json'), drc = repo.json('reports/drc.json');
    const passed = check.checks.filter(c => c.passed).length, total = check.checks.length, m = check.measured;
    const p1 = 'reports/independent-fabrication-check.json', p2 = 'reports/drc.json';
    const layers = Object.keys(m.tracks).length, plated = Object.values(m.drills_mm.plated).reduce((a, b) => a + b, 0);
    // The viewer's data is read from the saved KiCad board, not from the generator.
    execFileSync(process.execPath, [join(site, 'scripts/pcb-data.mjs'), join(repo.dir, 'cad/meridian-carrier.kicad_pcb'), join(repo.dir, 'cad/bill-of-materials.csv'), join(site, 'data/pcb-view.json')], {stdio: 'pipe'});
    repo.used.add('cad/meridian-carrier.kicad_pcb'); repo.used.add('cad/bill-of-materials.csv');
    return [
      {label: 'Fabrication-file checks', value: `${passed} of ${total} pass`, path: p1,
        line: `A separate script re-reads the Gerber and drill files and checks them against the board: ${passed} of ${total} checks pass.`},
      {label: 'KiCad layout rules', value: `${drc.violations.length} violations, ${drc.unconnected_items.length} unconnected`, path: p2,
        line: `KiCad ${drc.kicad_version.split('.')[0]} reports ${drc.violations.length} violations and ${drc.unconnected_items.length} unconnected items; ${drc.ignored_checks.length} checks are switched off and listed.`},
      {label: 'Board', value: `${m.board_mm[0]} × ${m.board_mm[1]} mm, ${layers} copper layers`, path: p1, line: ''},
      {label: 'Vias and plated holes', value: `${m.pads.vias} vias, ${plated} plated holes`, path: p1, line: ''}
    ];
  }
};

const facts = {}, sources = [];
for (const project of projects) {
  if (only.length && !only.includes(project.slug)) continue;
  const extract = extractors[project.slug];
  if (!extract) { console.warn(`${project.slug}: no extractor yet, so no figures are shown for it`); facts[project.slug] = []; continue; }
  const repo = openRepo(project.repo);
  facts[project.slug] = await extract(repo);
  for (const f of facts[project.slug]) if (f.path) repo.used.add(f.path);
  for (const e of project.evidence) if (!repo.has(e.path)) problems.push(`${project.slug}: evidence file ${e.path} is not in ${project.repo}`);
  for (const f of facts[project.slug]) if (f.path && !repo.has(f.path)) problems.push(`${project.slug}: fact file ${f.path} is not in ${project.repo}`);
  sources.push({repo: project.repo, commit: repo.commit, files: repo.used.size, ci: repo.has('.github/workflows')});
  console.log(`${project.slug}: ${facts[project.slug].length} figures from ${repo.used.size} files at ${repo.commit.slice(0, 7)}`);
}

if (problems.length) { console.error(problems.map(p => `  ${p}`).join('\n')); process.exit(1); }
if (!only.length) {
  mkdirSync(join(site, 'data'), {recursive: true});
  writeFileSync(join(site, 'data/facts.json'), JSON.stringify(facts, null, 2) + '\n');
  writeFileSync(join(site, 'data/sources.json'), JSON.stringify(sources, null, 2) + '\n');
  console.log('wrote data/facts.json and data/sources.json');
} else console.log('--only was used, so facts.json and sources.json were not rewritten');

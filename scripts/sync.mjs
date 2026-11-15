#!/usr/bin/env node
// Reads each project's own evidence files and writes the numbers this site shows, plus the commit each copy came from.
// Nothing on the site states a figure that this script did not read out of a file in the project's repository.
//
// usage: node scripts/sync.mjs [--repos <folder holding the project checkouts>] [--only sensor,lamp] [--strict]
//   --strict   stop if a checkout has uncommitted changes (use before publishing)
import {execFileSync} from 'node:child_process';
import {copyFileSync, cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync} from 'node:fs';
import {dirname, join, relative, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {projects} from '../assets/js/projects.js';

const site = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const option = (name, fallback) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : fallback; };
const reposDir = resolve(option('repos', resolve(site, '..')));
const only = (option('only', '') || '').split(',').filter(Boolean);
const strict = args.includes('--strict');
const num = n => Number(n).toLocaleString('en-GB');
const problems = [];

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
        line: `Every dimension on the sheets is read from the model: case ${e.width} × ${e.height} mm, ${v.slot_count} grille slots.`},
      {label: 'Gasket squeeze at nominal', value: `${s.nominal_squeeze_percent}%`, path,
        line: `Gasket squeeze is ${s.nominal_squeeze_percent}% at nominal: ${s.free_height} mm pressed to ${s.seat_to_land} mm.`},
      {label: 'Lift to release the wall cleat', value: `${t.upward_slide_to_clear_flange} mm`, path, line: `The case lifts ${t.upward_slide_to_clear_flange} mm to clear the wall cleat.`},
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
        line: `All ${files.length} files are exported again on every push and checked for size and length.`},
      {label: 'Ad sizes', value: sizes.join(' and ') + ' pixels', path: '.github/workflows/render.yml', line: `Ads are ${sizes.join(' and ')} pixels.`},
      {label: 'Story videos', value: `${length.join(', ')} s, ${dims.join(', ')}, ${frames.join(', ')} frames`, path: 'render_stories.py', line: ''}
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
      {label: 'Independent fabrication checks', value: `${passed} of ${total} pass`, path: p1,
        line: `A second tool re-reads the fabrication files: ${passed} of ${total} checks pass.`},
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
  facts[project.slug] = extract(repo);
  for (const f of facts[project.slug]) if (f.path) repo.used.add(f.path);
  for (const e of project.evidence) if (!repo.has(e.path)) problems.push(`${project.slug}: evidence file ${e.path} is not in ${project.repo}`);
  for (const f of facts[project.slug]) if (f.path && !repo.has(f.path)) problems.push(`${project.slug}: fact file ${f.path} is not in ${project.repo}`);
  sources.push({repo: project.repo, commit: repo.commit, files: repo.used.size});
  console.log(`${project.slug}: ${facts[project.slug].length} figures from ${repo.used.size} files at ${repo.commit.slice(0, 7)}`);
}

if (problems.length) { console.error(problems.map(p => `  ${p}`).join('\n')); process.exit(1); }
if (!only.length) {
  mkdirSync(join(site, 'data'), {recursive: true});
  writeFileSync(join(site, 'data/facts.json'), JSON.stringify(facts, null, 2) + '\n');
  writeFileSync(join(site, 'data/sources.json'), JSON.stringify(sources, null, 2) + '\n');
  console.log('wrote data/facts.json and data/sources.json');
} else console.log('--only was used, so facts.json and sources.json were not rewritten');

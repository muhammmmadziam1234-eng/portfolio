#!/usr/bin/env node
// Builds the text for the Upwork portfolio entries from data/facts.json, so a number in an entry cannot drift from the evidence.
// Upwork's form limits (checked against the live form before use): title 70 characters, role 100, description 600, five skills.
// usage: node scripts/upwork/entries.mjs [output folder]      writes entries.json and PORTFOLIO-ENTRIES.md
import {mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {projects} from '../../assets/js/projects.js';

const out = resolve(process.argv[2] ?? 'upwork');
const facts = JSON.parse(readFileSync(new URL('../../data/facts.json', import.meta.url), 'utf8'));
const f = (slug, label) => {
  const hit = facts[slug]?.find(x => x.label === label);
  if (!hit) throw new Error(`No figure "${label}" for ${slug}. Run npm run sync first.`);
  return hit.value;
};
const LIMITS = {title: 70, role: 100, description: 600, skills: 5};

const copy = {
  pcb: () => ({
    title: 'Four-layer sensor carrier PCB, checked from its fabrication files',
    role: 'PCB designer: schematic, layout, fabrication files and verification',
    skills: ['PCB Design', 'KiCad', 'Electronic Circuit Design', 'Hardware Design', 'Python'],
    description: `A four-layer carrier board for a 3.3 V controller with RS-485, SPI, I2C, analog sensing and low-side loads, designed in KiCad through to the Gerber and drill files. A second tool re-reads those files and checks them against the board: ${f('pcb', 'Independent fabrication checks')}, and KiCad's layout rules report ${f('pcb', 'KiCad layout rules')}. In the interactive viewer, click any track to light its whole net. No board has been built yet; the bring-up plan is in the repository.`
  }),
  sensor: () => ({
    title: 'Wall-mounted air sensor: 3D assembly with measured drawing sheets',
    role: '3D product designer: modelling, assembly, drawings and renders',
    skills: ['Blender', '3D Modeling', 'Product Design', '3D Rendering', 'Python'],
    description: `A wall-mounted air sensor modelled as a real assembly in Blender: housing, gasket, two circuit boards, a vent cassette and a wall cleat. The drawing sheets are generated from the model, so every dimension is measured (case ${f('sensor', 'Case size')}, gasket squeeze ${f('sensor', 'Gasket squeeze at nominal')} at nominal). In the interactive tour, pull the model apart with a slider and zoom into the sheets. A concept study: airflow, seal force and heat are not simulated.`
  }),
  lamp: () => ({
    title: 'Articulated desk lamp: 3D model with a verified motion study',
    role: '3D product designer: procedural modelling, rigging and motion study',
    skills: ['Blender', '3D Modeling', 'Product Design', '3D Animation', 'Python'],
    description: `A desk lamp with three driven hinges, modelled procedurally in Blender. Before rendering, the build script evaluated ${f('lamp', 'Joint combinations evaluated')} joint combinations across all three limits and checked all ${f('lamp', 'Motion frames checked')} frames of the motion for camera framing and cable fit. In the interactive tour, move the lamp through its poses and read the reach and height at each. A digital study: part clearance, friction and light output are not verified.`
  }),
  ads: () => ({
    title: 'Product ad campaigns: square, portrait and vertical story video',
    role: 'Visual designer: ad layouts, copy and export automation',
    skills: ['Graphic Design', 'Advertising', 'Python', 'Video Editing', 'Social Media Design'],
    description: `Square and portrait ads and seven-second vertical story videos for two products, composed in Python from Blender renders and exported at platform sizes (ads ${f('ads', 'Ad sizes')}; videos ${f('ads', 'Story videos')}). A GitHub check exports every file again on each push and checks sizes and length. The videos are silent by design, with type kept clear of platform controls.`
  })
};

const rows = [];
for (const p of projects) {
  const make = copy[p.slug];
  if (!make) { rows.push({slug: p.slug, todo: true, name: p.title}); continue; }
  const e = make();
  const problems = [];
  if (e.title.length > LIMITS.title) problems.push(`title ${e.title.length}/${LIMITS.title}`);
  if (e.role.length > LIMITS.role) problems.push(`role ${e.role.length}/${LIMITS.role}`);
  if (e.description.length > LIMITS.description) problems.push(`description ${e.description.length}/${LIMITS.description}`);
  if (e.skills.length > LIMITS.skills) problems.push(`skills ${e.skills.length}/${LIMITS.skills}`);
  if (/https?:\/\/|@\w|\bwww\./.test(e.description)) problems.push('description contains an address; Upwork does not allow contact details in text');
  rows.push({slug: p.slug, name: p.title, ...e, counts: {title: e.title.length, role: e.role.length, description: e.description.length}, problems});
}
mkdirSync(out, {recursive: true});
writeFileSync(resolve(out, 'entries.json'), JSON.stringify(rows, null, 2) + '\n');
const md = ['# Upwork portfolio entries', '', 'Copy each field into Portfolio, Add a project. Every number below is read from `data/facts.json`.', ''];
for (const r of rows) {
  if (r.todo) { md.push(`## ${r.name}`, '', '_Not written yet._', ''); continue; }
  md.push(`## ${r.name}`, '', `**Title** (${r.counts.title}/${LIMITS.title}): ${r.title}`, '', `**Your role** (${r.counts.role}/${LIMITS.role}): ${r.role}`, '',
    `**Description** (${r.counts.description}/${LIMITS.description}):`, '', r.description, '', `**Skills** (${r.skills.length}/${LIMITS.skills}): ${r.skills.join(', ')}`, '',
    r.problems.length ? `**Problems:** ${r.problems.join('; ')}` : '', '');
}
writeFileSync(resolve(out, 'PORTFOLIO-ENTRIES.md'), md.join('\n'));
const bad = rows.filter(r => r.problems?.length);
console.log(`${rows.filter(r => !r.todo).length} entries written to ${out}; ${rows.filter(r => r.todo).length} still to write; ${bad.length} with problems`);
for (const r of rows.filter(r => !r.todo)) console.log(`  ${r.slug}: title ${r.counts.title}, role ${r.counts.role}, description ${r.counts.description}${r.problems.length ? '  PROBLEMS: ' + r.problems.join('; ') : ''}`);
process.exitCode = bad.length ? 1 : 0;

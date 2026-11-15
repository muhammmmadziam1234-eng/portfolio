import {h} from '../util.js';
import {mountScrubber} from './scrubber.js';
import {lampFrames, lampLastFrame} from '../media.js';

const sign = n => (n < 0 ? '−' : '+') + Math.abs(Math.round(n)) + '°';
const angle = n => (n < 0 ? '−' : '') + Math.abs(n) + '°';
const two = n => (Math.round(n * 100) / 100).toFixed(2);

export default async function lamp(root) {
  const evidence = await (await fetch('data/lamp-evidence.json')).json();
  const named = evidence.motion.poses.filter(p => p.pose !== 'Return');
  const byFrame = new Map(named.map(p => [p.frame, p]));
  const frames = lampFrames.map(f => ({...f, alt: byFrame.has(f.frame)
    ? `The Formline lamp in the ${byFrame.get(f.frame).pose.toLowerCase()} pose`
    : `The Formline lamp part-way through its motion, frame ${f.frame} of ${lampLastFrame}`}));
  const frameOf = p => Math.round(p * (lampLastFrame - 1)) + 1;

  const box = h('div');
  const chips = named.map(p => h('button', {class: 'chip', type: 'button', 'aria-pressed': 'false', onclick: () => scrub.set((p.frame - 1) / (lampLastFrame - 1))}, p.pose));
  const readout = h('dl', {class: 'readout'});
  const scrub = mountScrubber(box, {
    frames, ratio: '800 / 650', label: 'Move the lamp', endLabels: ['Start of the motion', 'End of the loop'],
    valueText: p => { const f = frameOf(p), pose = byFrame.get(f); return `${pose ? `${pose.pose} pose, ` : ''}frame ${f} of ${lampLastFrame}`; },
    caption: `Frames from the project's Blender motion study, played at ${evidence.motion.fps} frames per second in the original.`,
    onChange: p => update(frameOf(p))
  });
  function update(frame) {
    const pose = byFrame.get(frame);
    chips.forEach((chip, i) => chip.setAttribute('aria-pressed', String(named[i] === pose)));
    const rows = pose
      ? [['Pose', pose.pose], ['Frame', `${pose.frame} of ${lampLastFrame}`], ['Forward reach, Blender units', two(pose.forward_reach_bu)], ['Height, Blender units', two(pose.height_bu)],
         ['Shade pitch', sign(pose.shade_pitch_deg)], ['Shoulder, elbow, head', pose.joint_angles_deg.map(angle).join(' / ')]]
      : [['Pose', 'Between named poses'], ['Frame', `${frame} of ${lampLastFrame}`]];
    readout.replaceChildren(...rows.map(([k, v]) => h('div', {}, h('dt', {}, k), h('dd', {}, v))));
  }
  root.append(box, h('div', {class: 'chips', role: 'group', 'aria-label': 'Jump to a named pose'}, chips), readout,
    h('p', {class: 'caption'}, 'Numbers appear at the four named poses. They are read from the study\'s evidence file, not worked out on this page.'));
  update(1);
  return {destroy() { scrub.destroy(); }};
}

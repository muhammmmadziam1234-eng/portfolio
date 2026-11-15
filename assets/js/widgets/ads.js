import {h, repoUrl} from '../util.js';

const stills = [
  {file: 'cirrus-square', name: 'Cirrus, square', size: '1080 by 1080', alt: 'Square Cirrus ad: the headline "Air in view." beside the sensor, with three labels along the bottom: vented front, status indicator and wall cleat.', source: 'exports/cirrus-square.png'},
  {file: 'cirrus-vertical', name: 'Cirrus, portrait', size: '1080 by 1350', alt: 'Portrait Cirrus ad: the headline "Air in view." and the sensor beside notes on its vented face, status light and wall cleat, with an "Inside Cirrus" strip showing the parts laid out.', source: 'exports/cirrus-vertical.png'},
  {file: 'formline-square', name: 'Formline, square', size: '1080 by 1080', alt: 'Square Formline ad: the lamp on a warm brown background above the headline "Light follows your lead." and a line about adjusting the arm and head.', source: 'exports/formline-square.png'},
  {file: 'formline-vertical', name: 'Formline, portrait', size: '1080 by 1350', alt: 'Portrait Formline ad: the headline "Light follows your lead." above the lamp, and an "A closer look" panel with a close-up of the hinge.', source: 'exports/formline-vertical.png'}
];
const stories = [
  {file: 'cirrus-story', name: 'Cirrus story', text: 'Seven seconds, vertical. Three frames: "Air in view.", "Look inside." with the parts laid out, and the product name.', source: 'exports/cirrus-story.mp4', storyboard: 'cirrus-storyboard'},
  {file: 'formline-story', name: 'Formline story', text: 'Seven seconds, vertical. Three frames: "Light follows your lead.", "Find your angle." close up on the hinge, and the product name.', source: 'exports/formline-story.mp4', storyboard: 'formline-storyboard'}
];

export default async function ads(root, {project}) {
  const grid = h('div', {class: 'media-grid'}, stills.map(s => h('figure', {},
    h('a', {href: repoUrl(project.repo, s.source), target: '_blank', rel: 'noopener', 'aria-label': `${s.name}, ${s.size} pixels. Opens the full-size file on GitHub.`},
      h('img', {src: `assets/media/ads/${s.file}.jpg`, alt: s.alt, loading: 'lazy', width: 380, height: s.file.endsWith('square') ? 380 : 475})),
    h('figcaption', {}, `${s.name}, ${s.size} pixels`))));
  const videos = h('div', {class: 'videos'}, stories.map(s => h('figure', {},
    h('video', {controls: true, preload: 'none', playsinline: true, muted: true, poster: `assets/media/ads/${s.file}-poster.jpg`, 'aria-describedby': `${s.file}-text`},
      h('source', {src: `assets/media/ads/${s.file}.mp4`, type: 'video/mp4'})),
    h('figcaption', {id: `${s.file}-text`, class: 'caption'}, h('strong', {}, s.name), '. ', s.text, ' ',
      h('a', {href: `assets/media/ads/${s.storyboard}.jpg`, target: '_blank', rel: 'noopener'}, 'Storyboard')))));
  root.append(
    h('div', {class: 'exhibit-bar'}, h('strong', {}, 'Ads'), h('span', {class: 'caption'}, 'Open any ad for the full-size file.')), grid,
    h('div', {class: 'exhibit-bar'}, h('strong', {}, 'Story videos'), h('span', {class: 'caption'}, 'Silent by design.')), videos);
  return {destroy() { root.querySelectorAll('video').forEach(v => v.pause()); }};
}

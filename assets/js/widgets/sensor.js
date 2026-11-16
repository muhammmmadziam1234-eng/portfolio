import {h} from '../util.js';
import {mountScrubber} from './scrubber.js';
import {mountPanZoom} from './panzoom.js';
import {makeTabs} from './ui.js';
import {explodeFrames, explodeText} from '../media.js';

export default async function sensor(root) {
  const apart = h('div');
  const scrub = mountScrubber(apart, {
    frames: explodeFrames, ratio: '1120 / 712', label: 'Pull the sensor apart', endLabels: ['Assembled', 'Exploded'], valueText: explodeText,
    caption: 'Each picture was rendered from the project\'s Blender file with its explode control set to that position.'
  });
  const sheetsPanel = h('div');
  const sheets = mountPanZoom(sheetsPanel, {
    sheets: [
      {id: 'section', label: 'Section through the case', src: 'assets/media/sensor/section.svg',
        alt: 'Drawing sheet: a longitudinal section through the Cirrus C-01 grille, sensor bay, bulkhead feedthrough and main circuit board, with dimensions.'},
      {id: 'mounting', label: 'Wall cleat and rail', src: 'assets/media/sensor/mounting.svg',
        alt: 'Drawing sheet: the Cirrus C-01 wall cleat elevation, rail cross-section and the upward travel needed to release the case, with dimensions.'}],
    caption: 'These sheets are generated from the model. The dimensions on them are read from it, not typed in.'
  });
  const tabs = makeTabs([
    {label: 'Pull it apart', panel: apart},
    {label: 'Drawing sheets', panel: sheetsPanel, onShow: () => requestAnimationFrame(() => sheets.fit())}
  ], {label: 'Ways to look at the sensor'});
  root.append(tabs.element);
  return {destroy() { scrub.destroy(); sheets.destroy(); }};
}

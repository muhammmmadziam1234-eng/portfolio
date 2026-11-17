// Frame sets for the two scrubbers. The images were rendered from the projects' own Blender files.
const pad = i => String(i).padStart(2, '0');

// 40 pictures, with the camera moving from the hero view to the exploded view (scripts/render/render_explode.py), and 39 more halfway
// between them. Each picture has a standard size (1120 pixels, what the canvas moves between) and the 40 main ones also a large size
// (`hi`, 1680 pixels, what the page shows at rest on a screen that needs it: a picture more than 900 device pixels across). The in-between pictures are `dense`: they only add smoothness to
// motion, and cost memory, so the scrubber loads them on a desktop-class device only. scripts/render/make_sets.py builds the files.
const explodeCount = 40, explodeLast = explodeCount - 1, explodeDir = 'assets/media/cirrus-explode';
const explodeAlt = at => at === 0 ? 'The Cirrus sensor assembled'
  : at === 1 ? 'The Cirrus sensor fully exploded: cover, gasket, boards, housing and wall cleat in a row' : `The Cirrus sensor ${Math.round(at * 100)} percent exploded`;
export const explodeFrames = Array.from({length: explodeCount * 2 - 1}, (_, k) => {
  const i = k >> 1, between = k & 1, at = (i + between / 2) / explodeLast;
  return between
    ? {src: `${explodeDir}/explode-${pad(i)}b.webp`, at, alt: explodeAlt(at), dense: true}
    : {src: `${explodeDir}/explode-${pad(i)}.webp`, hi: `${explodeDir}/hi/explode-${pad(i)}.webp`, at, alt: explodeAlt(at)};
});

export const explodeText = p => p < 0.02 ? 'Assembled' : p > 0.98 ? 'Fully exploded' : `${Math.round(p * 100)} percent exploded`;

// The lamp study runs for 90 frames at 15 fps. These are the frames that were rendered, in order,
// which include the four named poses (frames 1, 21, 44 and 64).
const lampFrameNumbers = [1, 5, 9, 13, 17, 21, 25, 29, 33, 37, 41, 44, 45, 49, 53, 57, 61, 64, 65, 69, 73, 77, 81, 84, 85, 89, 90];
export const lampLastFrame = 90;
export const lampFrames = lampFrameNumbers.map((frame, i) => ({
  src: `assets/media/lamp-pose/pose-${pad(i)}.jpg`, at: (frame - 1) / (lampLastFrame - 1), frame
}));

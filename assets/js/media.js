// Frame sets for the two scrubbers. The images were rendered from the projects' own Blender files.
const pad = i => String(i).padStart(2, '0');

export const explodeFrames = Array.from({length: 14}, (_, i) => ({
  src: `assets/media/cirrus-explode/explode-${pad(i)}.jpg`, at: i / 13,
  alt: i === 0 ? 'The Cirrus sensor assembled' : i === 13 ? 'The Cirrus sensor fully exploded: cover, gasket, boards, housing and wall cleat in a row' : `The Cirrus sensor ${Math.round(i / 13 * 100)} percent exploded`
}));

export const explodeText = p => p < 0.02 ? 'Assembled' : p > 0.98 ? 'Fully exploded' : `${Math.round(p * 100)} percent exploded`;

// The lamp study runs for 90 frames at 15 fps. These are the frames that were rendered, in order,
// which include the four named poses (frames 1, 21, 44 and 64).
const lampFrameNumbers = [1, 5, 9, 13, 17, 21, 25, 29, 33, 37, 41, 44, 45, 49, 53, 57, 61, 64, 65, 69, 73, 77, 81, 84, 85, 89, 90];
export const lampLastFrame = 90;
export const lampFrames = lampFrameNumbers.map((frame, i) => ({
  src: `assets/media/lamp-pose/pose-${pad(i)}.jpg`, at: (frame - 1) / (lampLastFrame - 1), frame
}));

# Portfolio

[![Tests](https://github.com/muhammmmadziam1234-eng/portfolio/actions/workflows/test.yml/badge.svg?branch=main)](https://github.com/muhammmmadziam1234-eng/portfolio/actions/workflows/test.yml)

An interactive walk through eight projects: a four-layer circuit board, two 3D product studies, ad layouts, and four software tools. Each project opens with something to try, and every number beside it links to the file in the project's own repository that holds it.

It is plain HTML, CSS and JavaScript. There is no build step, no tracking, no cookies and no request to any other site.

## What a visitor can do

| Project | What they can try |
| --- | --- |
| Cirrus C-01 sensor | Pull the 3D model apart with a slider, then zoom into its drawing sheets |
| Formline lamp | Move the lamp through its motion and read the reach and height at each named pose |
| Cirrus and Formline campaigns | Open the ads and play the two story videos |
| Meridian carrier board | Click any track to light its whole net, pick a part and see it framed, read the bill of materials |
| Flood Exposure Atlas | Switch scenarios, filter, and load their own data in the real app |
| GeoJSON Quality Kit | Clean a messy file, or paste their own, and read the issue table |
| Relay Desk tracker | Watch the real app, then read its API contract |
| Second Coat paint estimator | Build a multi-room quote and print it |

## Run it

```bash
npm ci
npm start
```

Open http://127.0.0.1:8080/.

## Test it

```bash
npm test
```

The tests open every page in a real browser, on a desktop and a phone-sized screen, and check that:

- nothing fails to load, nothing is requested from another site, and no cookie is set;
- the page does not scroll sideways;
- an accessibility scan (axe-core) finds nothing;
- each demo works: the sliders and tabs respond to the keyboard, the lamp readout shows the numbers from its evidence file, the circuit board lights the right net, and the overview table shows figures that come from `data/facts.json`.

`npm run lighthouse` runs Lighthouse against the site on a local server. `--write` saves the scores to `docs/evidence/lighthouse.json`.

## Where the numbers come from

Nothing on a project page states a figure that was typed in by hand. `scripts/sync.mjs` reads each project's own evidence files and writes:

- `data/facts.json`: the figures shown beside each demo, each with the path of the file it came from;
- `data/sources.json`: the commit of each repository the site was built from.

```bash
npm run sync -- --repos ..
```

`--repos` is the folder that holds the project checkouts side by side. `--strict` stops if a checkout has uncommitted changes, which is how it is run before publishing. The script also stops if a file the site links to is not in the repository.

The circuit board viewer reads the saved KiCad board file, not the script that generated it (`scripts/pcb-data.mjs`).

## Publish it on GitHub Pages

1. Create a public repository named `portfolio` on GitHub and push this folder to its `main` branch.
2. In the repository, open **Settings → Pages**. Under **Build and deployment**, choose **Deploy from a branch**, pick **main** and **/ (root)**, then save.
3. After a minute the site is at `https://<your-user-name>.github.io/portfolio/`.

If you name the repository something else, change the three web addresses that mention `/portfolio/` in `index.html` and the badge address in this README.

## Make it yours

Edit `site.config.js`:

```js
export default {
  name: 'Your name',                       // shown in the header and the footer
  upworkUrl: 'https://www.upwork.com/…',   // adds a button in the header; leave empty to hide it
  githubUser: 'your-github-user-name'      // where every "source" link points
};
```

## How it is put together

- **One page, hash addresses.** `#/p/pcb` is the circuit board. A page that is not found falls back to the home page, so a link can never lead nowhere.
- **Each demo is a small module** in `assets/js/widgets/`. It receives an empty element and fills it, so the page is built once, off screen, and shown when ready. Nothing below a demo moves when it arrives.
- **The two 3D studies are image sequences** rendered from the projects' own Blender files (`scripts/render/`), because a browser cannot open a Blender file. The pose numbers beside the lamp come from its evidence file, not from the pictures.
- **The flood map and the paint estimator run as they are.** `demos/` holds an unmodified copy of each repository's web app, so the demo and the repository cannot disagree.
- **The service desk is shown as a recording**, because it needs a server. The recording is made from the real app by a script in its repository.
- **Fonts and motion.** One variable font (Archivo, SIL Open Font Licence, in `assets/fonts`). Motion respects the system's reduced-motion setting, and the slider works without it.

## Limits

- The 3D pictures are renders of concept studies. Nothing here claims a physical prototype exists.
- The Lighthouse scores are one run each on a local server with Lighthouse's default simulated phone. A run on the public site will differ a little.
- The demos use fictional data.

© 2026 muhammmmadziam1234-eng. All rights reserved, except the typeface in [assets/fonts](assets/fonts), which keeps its own licence.

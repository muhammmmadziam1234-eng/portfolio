# Portfolio

[![Tests](https://github.com/muhammmmadziam1234-eng/portfolio/actions/workflows/test.yml/badge.svg?branch=main)](https://github.com/muhammmmadziam1234-eng/portfolio/actions/workflows/test.yml)

The portfolio site of a freelance engineer for web maps and data tools: eight projects in three groups (geospatial and data, web applications, hardware and product design). Each project opens with something to try, and every number beside it links to the file in the project's own repository that holds it.

It is plain HTML, CSS and JavaScript. There is no build step, no tracking, no cookies and no request to any other site.

## What a visitor can do

| Project | What they can try |
| --- | --- |
| Flood Exposure Atlas | Switch scenarios, filter, and load their own data in the real app |
| GeoJSON Quality Kit | Clean a messy file, or paste their own, and read the issue table |
| Relay Desk tracker | Watch the real app, then read its API contract |
| Second Coat paint estimator | Build a multi-room quote and print it |
| Meridian carrier board | Click any track to light its whole net, pick a part and see it framed, read the bill of materials |
| Cirrus C-01 sensor | Pull the 3D model apart with a slider, then zoom into its drawing sheets |
| Formline lamp | Move the lamp through its motion and read the reach and height at each named pose |
| Cirrus and Formline campaigns | Open the ads and play the two story videos |

Besides the projects there is an About page (`#/about`), a Verification page on how the work is checked (`#/method`), and a contact band at the foot of the home page (`#/contact`). The "Hire me on Upwork" button stays in the header on every page.

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

The tests open every page in a real browser, on a desktop and a phone-sized screen, in light and dark mode, and check that:

- nothing fails to load, nothing is requested from another site, and no cookie is set;
- the page does not scroll sideways (also at 320 and 2560 pixels wide), and content stays within 1200 pixels;
- an accessibility scan (axe-core) finds nothing;
- every page has its own title and description, the header is one row, and the hire button is in it;
- the phone menu opens, closes with Escape and returns focus to its button;
- each demo works: the sliders and tabs respond to the keyboard, the lamp readout shows the numbers from its evidence file, the circuit board lights the right net, and the figures on the home page and the project pages come from `data/facts.json`, each linked to its source file;
- each share page (`p/<slug>/`) carries the project's preview tags and opens the project.

`npm run lighthouse` runs Lighthouse against the site on a local server. `--write` saves the scores to `docs/evidence/lighthouse.json`.

## Where the numbers come from

No figure beside a demo is typed in by hand. `scripts/sync.mjs` reads each project's own evidence files and writes (the descriptive text around the figures is written by hand and was checked against the repositories):

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

If you name the repository something else, change `siteUrl` in `site.config.js`, the web addresses that mention `/portfolio/` in `index.html` and the badge address in this README, then run `node scripts/share.mjs`.

## Make it yours

Everything personal is in `site.config.js`. An empty value hides what it would show, so nothing half-finished appears on the site.

| Field | What it does |
| --- | --- |
| `name` | Header, footer, home heading and page titles. Empty shows "Portfolio". |
| `role` | One line under your name on the home page, and in the footer. |
| `tagline` | One sentence under the role: what you build and for whom. |
| `bio` | A few sentences for the About page. |
| `location` | Where you work from, on the About page. |
| `availability` | For example "Taking new projects", on the About page. |
| `email` | Adds "Send an email" to the contact band and an Email link to the footer. Only if you want it public. |
| `photo` | Path to a square photo for the About page, for example `assets/img/photo.jpg`. |
| `upworkUrl` | Adds the "Hire me on Upwork" button to the header and the contact band. |
| `siteUrl` | Where the site is published; used by the share pages and preview pictures. |
| `githubUser` | Where every "Source file" and repository link points. |
| `featured` | The three projects shown large on the home page, by address name (`atlas`, `kit`, `lamp`, ...). |
| `services` | The "What I can build for you" blocks: a title and a sentence each. Keep figures out of them. |

Fields marked `DRAFT` hold suggested wording to edit; fields marked `TODO(owner)` are empty until you fill them in. Each project's text, group and tags are in `assets/js/projects.js`. After changing a title, summary or picture, run `node scripts/share.mjs` (below).

## How it is put together

- **One page, hash addresses.** `#/` is the home page (`#/all` scrolls to the work, `#/contact` to the contact band), `#/about`, `#/method` (Verification) and `#/p/pcb` for the circuit board. An address that matches nothing shows a short not-found page with a link to all the projects. Each address sets its own title and description.
- **Share pages.** Social sites do not run the app, so `p/<slug>/index.html` holds each project's title, description and 1200 by 630 preview picture, then opens `#/p/<slug>`. Run `node scripts/share.mjs` by hand whenever a project, a card picture or `site.config.js` changes, then commit the output. It writes the preview pictures (`assets/img/og.jpg`, `assets/img/share/<slug>.jpg`, drawn from `scripts/og.html`) and the pages.
- **Card pictures and icons.** `node scripts/cards.mjs` makes the 960 by 720 card pictures in `assets/img/cards/` from the projects' renders and from screenshots of the demos, plus the PNG icons. Run it by hand when a source picture changes; the output is committed.
- **Each demo is a small module** in `assets/js/widgets/`. It receives an empty element and fills it, so the page is built once, off screen, and shown when ready. Nothing below a demo moves when it arrives.
- **The two 3D studies are image sequences** rendered from the projects' own Blender files (`scripts/render/`), because a browser cannot open a Blender file. The sensor's 40 frames follow a camera that moves from the hero view to the exploded view, so the sensor fills the picture at every step. The pose numbers beside the lamp come from its evidence file, not from the pictures.
- **The flood map, the GeoJSON cleaner and the paint estimator run as they are.** `demos/` holds each project's own web files, copied unchanged (tests, tooling and documents stay in the repository), so the demo and the repository cannot disagree.
- **The service desk is shown as a recording**, because it needs a server. `scripts/record-tracker.mjs` in this repository starts the real app from a checkout of the project and drives it in a browser; the recording has a step list and an API tab beside it.
- **Styles.** `assets/css/site.css` is in sections: tokens (colour, type, space, shape, with a dark set that follows the system setting), base, layout, components, header and footer, pages, demo chrome, responsive. The apps in frames stay light in both modes.
- **Fonts and motion.** One variable font (Archivo, SIL Open Font Licence, in `assets/fonts`). Motion is limited to hover and focus and a short fade between pages, and respects the system's reduced-motion setting; the slider works without it.

## Upwork pictures, videos and text

Upwork cannot embed an interactive page, so a portfolio entry links to this site and carries a few pictures and a short video. These scripts make them from the real pages, so they cannot drift from the site (they write to `upwork/`, which is not committed):

```bash
node scripts/upwork/entries.mjs   # the text of each entry, with the character counts checked against Upwork's limits
node scripts/upwork/plates.mjs    # 1500 by 1125 pictures of each demo in a telling state
node scripts/upwork/record.mjs    # a short captioned clip per project, and a combined tour that stays under 60 seconds
node scripts/record-tracker.mjs --repo ../service-request-tracker --node <path to Node 24>   # the service desk recording on the site
```

© 2026 muhammmmadziam1234-eng. All rights reserved, except the typeface in [assets/fonts](assets/fonts), which keeps its own licence.

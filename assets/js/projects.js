// All copy for the eight projects. Numbers do not live here: they come from data/facts.json,
// which scripts/sync.mjs reads out of each repository's own evidence files.
export const projects = [
  {
    slug: 'sensor', repo: 'cirrus-environment-sensor', widget: 'sensor', thumb: 'assets/img/sensor.jpg',
    title: 'Cirrus C-01 environmental sensor', kind: '3D product design in Blender',
    short: 'A wall-mounted air sensor built as a real assembly.',
    summary: 'A wall-mounted air sensor modelled as a real assembly: housing, gasket, two circuit boards, a vent cassette and a wall cleat. The drawing sheets are measured from the model itself, not drawn by hand.',
    tryShort: 'Pull it apart, then zoom into the drawings.',
    tryIt: ['Drag the slider, or drag across the picture, to pull the sensor apart.', 'Open Drawing sheets, pick a sheet and zoom in on the gasket detail or the wall cleat.'],
    evidence: [
      {label: 'Handoff measurements', note: 'Every dimension on the sheets, read from the model', path: 'handoff/measurements.json'},
      {label: 'Check script', note: 'Rebuilds the sheets from the model and fails if they differ', path: 'build_handoff.py'},
      {label: 'README', note: 'What the model includes and what it does not claim', path: 'README.md'}],
    stack: 'Blender 4.5 and Python',
    limits: 'A concept study with geometry only. Airflow, seal force and thermal behaviour are not simulated, as the README states.'
  },
  {
    slug: 'lamp', repo: 'formline-articulated-lamp', widget: 'lamp', thumb: 'assets/img/lamp.jpg',
    title: 'Formline articulated desk lamp', kind: '3D product design and motion study in Blender',
    short: 'A lamp with three driven hinges, every pose checked.',
    summary: 'A desk lamp modelled procedurally with three driven hinges. Before anything was rendered, the build checked joint combinations across all three limits and every frame of the motion for framing and cable fit.',
    tryShort: 'Move the lamp through its motion.',
    tryIt: ['Drag the pose slider to move the lamp.', 'Use the buttons to jump to the four named poses and read the reach and height.'],
    evidence: [
      {label: 'Numerical evidence', note: 'Reach, height and shade angle for the named poses, and the sampled ranges', path: 'articulation-evidence.json'},
      {label: 'Build script', note: 'Checks pins, link lengths, framing and cable anchors before rendering', path: 'build_formline.py'},
      {label: 'Motion script', note: 'The keyframed motion study and its checks', path: 'articulation.py'}],
    stack: 'Blender 4.5 and Python',
    limits: 'Digital geometry and kinematics only. Part clearance, cable strain, joint friction, tipping and light output are unverified; physical prototyping is pending, as the README states.'
  },
  {
    slug: 'ads', repo: 'cirrus-formline-ad-campaigns', widget: 'ads', thumb: 'assets/img/ads.jpg',
    title: 'Cirrus and Formline campaigns', kind: 'Advertising layouts composed in Python',
    short: 'Square, portrait and vertical video ads for two products.',
    summary: 'Square and portrait ads and seven-second vertical story edits for both products, composed in Python from the Blender renders and exported at platform sizes.',
    tryShort: 'Open the ads and play the two story videos.',
    tryIt: ['Open any ad at full size.', 'Play the two story videos. They are silent by design, with type kept clear of platform controls.'],
    evidence: [
      {label: 'Render check', note: 'GitHub re-exports everything on every push and checks sizes and length', path: '.github/workflows/render.yml'},
      {label: 'Layout script', note: 'All copy, sizes and crops in one file', path: 'render_ads.py'},
      {label: 'Story script', note: 'Timing, crop animation and a decode check for each video', path: 'render_stories.py'}],
    stack: 'Python, Pillow and ffmpeg',
    limits: 'The published files were set in Windows fonts. The scripts fall back to bundled open fonts, so a re-run is close but not identical.'
  },
  {
    slug: 'pcb', repo: 'industrial-sensor-carrier-pcb', widget: 'pcb', thumb: 'assets/img/pcb.jpg',
    title: 'Meridian four-layer carrier board', kind: 'PCB design in KiCad',
    short: 'A 3.3 V controller board, checked from its fabrication files.',
    summary: 'A four-layer carrier for a 3.3 V controller with RS-485, SPI, I²C, analog sensing and low-side loads. The view is drawn from the saved KiCad board, and a second tool re-reads the Gerber and drill files to check them against that board.',
    tryShort: 'Click any track to light up its whole net.',
    tryIt: ['Click a track, pad or via to light up everything on its net.', 'Switch layers, or choose a part from the list to find it on the board.'],
    evidence: [
      {label: 'Independent fabrication check', note: 'Reads only the files a fabricator receives', path: 'reports/independent-fabrication-check.json'},
      {label: 'KiCad rule check', note: 'Layout rule results from KiCad 10, including the rules switched off', path: 'reports/drc.json'},
      {label: 'Bring-up plan', note: 'How the first board would be tested', path: 'first-article.md'}],
    stack: 'KiCad 10, Python, shapely and gerbonara',
    limits: 'A design for prototype review. No board has been built or tested yet; the bring-up plan lists what to measure first. Part numbers have not been checked against manufacturer pages.'
  },
  {
    slug: 'atlas', repo: 'flood-exposure-atlas', widget: 'embed', embed: 'demos/atlas/index.html', thumb: 'assets/img/atlas.jpg',
    title: 'Flood Exposure Atlas', kind: 'Map and spatial analysis in JavaScript',
    short: 'A flood map that classifies facilities against overlapping zones.',
    summary: 'A map and a batch tool that classify facilities against overlapping flood zones. The analysis was cross-checked against Shapely, a separate geometry library, on generated cases, and the map runs with no dependencies.',
    tryShort: 'Switch scenarios, filter, and load your own data.',
    tryIt: ['Switch from Baseline to Expanded extent and see which facilities change.', 'Filter by exposure level, select a facility, then export the result.'],
    evidence: [
      {label: 'Cross-check against Shapely', note: 'Generated cases, with every disagreement counted', path: 'docs/evidence/crosscheck.json'},
      {label: 'Benchmark', note: 'Timings with the machine they were measured on', path: 'docs/evidence/benchmark.json'},
      {label: 'Analysis code', note: 'Point-in-polygon rules and the grid index', path: 'geo.mjs'}],
    stack: 'JavaScript, SVG and Python (for the cross-check)',
    limits: 'Fictional data. The map is a demonstration and must not be used for planning or emergency decisions, as the page itself says.'
  },
  {
    slug: 'kit', repo: 'geojson-quality-kit', widget: 'geojson', thumb: 'assets/img/kit.jpg',
    title: 'GeoJSON Quality Kit', kind: 'Data cleaning tool in JavaScript',
    short: 'Cleans GeoJSON and reports every record it rejects.',
    summary: 'A command-line tool and library that cleans GeoJSON: it normalises ids and labels, checks coordinates and polygon rings, removes duplicates, and lists every rejected record with a reason. It runs here exactly as it does on the command line.',
    tryShort: 'Clean a messy file, or paste your own.',
    tryIt: ['Read the issue table for the example file: each rejected record has a rule name, what happened and what to do.', 'Edit the text, paste your own GeoJSON or open a file, then press Clean. Nothing leaves your browser.'],
    evidence: [
      {label: 'Report format', note: 'JSON Schema for the report, checked by a test', path: 'report.schema.json'},
      {label: 'Benchmark', note: 'Large-file timings with the machine they were measured on', path: 'docs/evidence/benchmark.json'},
      {label: 'README', note: 'Rules table and limits', path: 'README.md'}],
    stack: 'JavaScript with no dependencies',
    limits: 'No reprojection and no repair of broken geometry beyond the rules listed in the README.'
  },
  {
    slug: 'tracker', repo: 'service-request-tracker', widget: 'recording', thumb: 'assets/img/tracker.jpg',
    title: 'Relay Desk service request tracker', kind: 'Full-stack web app in TypeScript',
    short: 'A service desk with sign-in, roles and conflict-safe edits.',
    summary: 'An internal service desk: sign-in with roles, requests with priority and assignee, comments, and edits that cannot silently overwrite each other. The server is TypeScript run directly by Node, with an OpenAPI file and tests that check the API against it.',
    tryShort: 'Watch the real app, then read the API contract.',
    tryIt: ['Watch the recording: sign in, create, assign, comment, and the same request edited in two windows.', 'Open the OpenAPI file or the tests to see exactly how it behaves.'],
    evidence: [
      {label: 'API contract', note: 'Every route, schema and error, checked against the live server', path: 'openapi.json'},
      {label: 'Coverage record', note: 'Measured line coverage of the source', path: 'docs/evidence/coverage.txt'},
      {label: 'README', note: 'Security model, decisions and limits', path: 'README.md'}],
    stack: 'TypeScript, Node 24, SQLite, Docker',
    limits: 'It needs a server, so it is shown as a recording of the real app. Sign-in uses demo accounts; real use would need real accounts.'
  },
  {
    slug: 'paint', repo: 'room-paint-estimator', widget: 'embed', embed: 'demos/paint/index.html', thumb: 'assets/img/paint.jpg',
    title: 'Second Coat paint estimator', kind: 'Front-end app in JavaScript',
    short: 'A multi-room painting quote with a printable page.',
    summary: 'A quote builder for a fictional painting studio: several rooms, doors and windows, metric or imperial input, exact prices to the cent, saved quotes, a one-page printable quote, and offline use.',
    tryShort: 'Build a three-room quote and print it.',
    tryIt: ['Add a second room and switch the units to feet.', 'Press Print and look at the quote page.'],
    evidence: [
      {label: 'Lighthouse scores', note: 'Measured on a local server, with the date and versions', path: 'docs/evidence/lighthouse.json'},
      {label: 'Pricing engine', note: 'Integer arithmetic only, rules written out in the README', path: 'quote.mjs'},
      {label: 'README', note: 'Pricing rules, decisions and limits', path: 'README.md'}],
    stack: 'JavaScript with no dependencies',
    limits: 'Prices and discounts are a fictional rate card. It is a demonstration, not a booking system.'
  }
];

export const bySlug = Object.fromEntries(projects.map(p => [p.slug, p]));

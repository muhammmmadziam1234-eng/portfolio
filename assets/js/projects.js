// All copy for the eight projects, in the order they are shown. Numbers do not live here: they come from data/facts.json,
// which scripts/sync.mjs reads out of each repository's own evidence files.
// group: which heading the project sits under (see groups below). tags: the main tools, shown on cards.
export const groups = [
  {
    "id": "geo",
    "label": "Geospatial and data",
    "intro": "Maps, spatial analysis and tools that make location data dependable."
  },
  {
    "id": "web",
    "label": "Web applications",
    "intro": "Complete applications, from the interface to the tests behind it."
  },
  {
    "id": "hardware",
    "label": "Hardware and product design",
    "intro": "Circuit boards, product models and the visuals that present them."
  }
];

export const projects = [
  {
    "slug": "atlas",
    "group": "geo",
    "repo": "flood-exposure-atlas",
    "widget": "embed",
    "embed": "demos/atlas/index.html",
    "thumb": "assets/img/cards/atlas.webp",
    "title": "Flood Exposure Atlas",
    "kind": "Map and spatial analysis in JavaScript",
    "short": "A flood map that classifies facilities against overlapping zones.",
    "summary": "A map and a batch tool that classify facilities against overlapping flood zones. The analysis was cross-checked against Shapely, a separate geometry library, on generated cases, and the map runs with no dependencies.",
    "tryShort": "Switch scenarios, filter, and load your own data.",
    "tryIt": [
      "Switch from Baseline to Expanded extent and see which facilities change.",
      "Filter by exposure level, select a facility, then export the result."
    ],
    "evidence": [
      {
        "label": "Cross-check against Shapely",
        "note": "Generated cases, with every disagreement counted",
        "path": "docs/evidence/crosscheck.json"
      },
      {
        "label": "Benchmark",
        "note": "Timings with the machine they were measured on",
        "path": "docs/evidence/benchmark.json"
      },
      {
        "label": "Analysis code",
        "note": "Point-in-polygon rules and the grid index",
        "path": "geo.mjs"
      }
    ],
    "stack": "JavaScript, SVG and Python (for the cross-check)",
    "tags": [
      "JavaScript",
      "SVG",
      "Python"
    ]
  },
  {
    "slug": "kit",
    "group": "geo",
    "repo": "geojson-quality-kit",
    "widget": "geojson",
    "thumb": "assets/img/cards/kit.webp",
    "title": "GeoJSON Quality Kit",
    "kind": "Data cleaning tool in JavaScript",
    "short": "Cleans GeoJSON and reports the records it rejects, with reasons.",
    "summary": "A command-line tool and library that cleans GeoJSON: it normalises ids and labels, checks coordinates and polygon rings, removes duplicates, and lists the rejected records with a reason. It runs here exactly as it does on the command line.",
    "tryShort": "Clean a messy file, or paste your own.",
    "tryIt": [
      "Read the issue table for the example file: each rejected record has a rule name, what happened and what to do.",
      "Edit the text, paste your own GeoJSON or open a file, then press Clean. Nothing leaves your browser."
    ],
    "evidence": [
      {
        "label": "Report format",
        "note": "JSON Schema for the report, checked by a test",
        "path": "report.schema.json"
      },
      {
        "label": "Benchmark",
        "note": "Large-file timings with the machine they were measured on",
        "path": "docs/evidence/benchmark.json"
      },
      {
        "label": "README",
        "note": "Rules table and how to use it",
        "path": "README.md"
      }
    ],
    "stack": "JavaScript with no dependencies",
    "tags": [
      "JavaScript",
      "Node.js",
      "GeoJSON"
    ]
  },
  {
    "slug": "tracker",
    "group": "web",
    "repo": "service-request-tracker",
    "widget": "recording",
    "thumb": "assets/img/cards/tracker.webp",
    "title": "Relay Desk service request tracker",
    "kind": "Full-stack web app in TypeScript",
    "short": "A service desk with sign-in, roles and conflict-safe edits.",
    "summary": "An internal service desk: sign-in with roles, requests with priority and assignee, comments, and edits that cannot silently overwrite each other. The server is TypeScript run directly by Node, with an OpenAPI file (a written list of every request the server accepts) and tests that check the API against it.",
    "tryShort": "Watch the real app, then read the API contract.",
    "tryIt": [
      "Watch the recording: sign in as a requester and open a request, then as an agent assign it and comment, then see what happens when a colleague saves the same request first.",
      "Open the API contract tab to see every route and a real session with the API, then the OpenAPI file or the tests for the detail."
    ],
    "evidence": [
      {
        "label": "API contract",
        "note": "Every route with its request and response schemas, checked against the running server",
        "path": "openapi.json"
      },
      {
        "label": "Coverage record",
        "note": "Measured line coverage of the source",
        "path": "docs/evidence/coverage.txt"
      },
      {
        "label": "README",
        "note": "Security model and decisions",
        "path": "README.md"
      }
    ],
    "stack": "TypeScript, Node 24, SQLite, Docker",
    "tags": [
      "TypeScript",
      "Node.js",
      "SQLite",
      "Docker"
    ]
  },
  {
    "slug": "paint",
    "group": "web",
    "repo": "room-paint-estimator",
    "widget": "embed",
    "embed": "demos/paint/index.html",
    "thumb": "assets/img/cards/paint.webp",
    "title": "Second Coat paint estimator",
    "kind": "Front-end app in JavaScript",
    "short": "A multi-room painting quote with a printable page.",
    "summary": "A quote builder for a fictional painting studio: several rooms, doors and windows, metric or imperial input, exact prices to the cent, saved quotes, a one-page printable quote, and offline use.",
    "tryShort": "Build a three-room quote and print it.",
    "tryIt": [
      "Add a second room and switch the units to feet.",
      "Press Print and look at the quote page."
    ],
    "evidence": [
      {
        "label": "Lighthouse scores",
        "note": "Google's page-quality check, run on a local server, with the date and versions",
        "path": "docs/evidence/lighthouse.json"
      },
      {
        "label": "Pricing engine",
        "note": "Integer arithmetic only, rules written out in the README",
        "path": "quote.mjs"
      },
      {
        "label": "README",
        "note": "Pricing rules and decisions",
        "path": "README.md"
      }
    ],
    "stack": "JavaScript with no dependencies",
    "tags": [
      "JavaScript",
      "HTML",
      "CSS"
    ]
  },
  {
    "slug": "pcb",
    "group": "hardware",
    "repo": "industrial-sensor-carrier-pcb",
    "widget": "pcb",
    "thumb": "assets/img/cards/pcb.webp",
    "title": "Meridian four-layer carrier board",
    "kind": "PCB design in KiCad",
    "short": "A 3.3 V controller board, checked from its fabrication files.",
    "summary": "A four-layer carrier for a 3.3 V controller with RS-485, SPI, I²C, analog sensing and low-side loads. The view is drawn from the saved KiCad board, and a separate script re-reads the Gerber and drill files (the files a factory uses to make a board) with gerbonara to check them against that board.",
    "tryShort": "Click any track to light up the whole connection it belongs to.",
    "tryIt": [
      "Click a track, pad or via to light up everything on its net, the one electrical connection it belongs to.",
      "Switch layers, or choose a part from the list to find it on the board."
    ],
    "evidence": [
      {
        "label": "Fabrication-file check",
        "note": "Reads only the files a fabricator receives",
        "path": "reports/independent-fabrication-check.json"
      },
      {
        "label": "KiCad rule check",
        "note": "Layout rule results from KiCad 10, including the rules switched off",
        "path": "reports/drc.json"
      },
      {
        "label": "Bring-up plan",
        "note": "How the first board would be tested",
        "path": "first-article.md"
      }
    ],
    "stack": "KiCad 10, Python, shapely and gerbonara",
    "tags": [
      "KiCad",
      "Python"
    ]
  },
  {
    "slug": "sensor",
    "group": "hardware",
    "repo": "cirrus-environment-sensor",
    "widget": "sensor",
    "thumb": "assets/img/cards/sensor.webp",
    "title": "Cirrus C-01 environmental sensor",
    "kind": "3D product design in Blender",
    "short": "A wall-mounted air sensor built as a real assembly.",
    "summary": "A wall-mounted air sensor modelled as a real assembly: housing, gasket, two circuit boards, a vent cassette and a wall cleat. The dimensions on the drawing sheets are read from the model itself, not drawn by hand.",
    "tryShort": "Pull it apart, then zoom into the drawings.",
    "tryIt": [
      "Drag the slider, or drag across the picture, to pull the sensor apart.",
      "Open Drawing sheets, pick a sheet and zoom in on the gasket detail or the wall cleat."
    ],
    "evidence": [
      {
        "label": "Handoff measurements",
        "note": "The dimensions on the sheets, read from the model",
        "path": "handoff/measurements.json"
      },
      {
        "label": "Check script",
        "note": "Rebuilds the sheets from the model and fails if they differ",
        "path": "build_handoff.py"
      },
      {
        "label": "README",
        "note": "What the model includes and how to open it",
        "path": "README.md"
      }
    ],
    "stack": "Blender 4.5 and Python",
    "tags": [
      "Blender",
      "Python"
    ]
  },
  {
    "slug": "lamp",
    "group": "hardware",
    "repo": "formline-articulated-lamp",
    "widget": "lamp",
    "thumb": "assets/img/cards/lamp.webp",
    "title": "Formline articulated desk lamp",
    "kind": "3D product design and motion study in Blender",
    "short": "A lamp with three driven hinges and a sampled range of motion.",
    "summary": "A desk lamp modelled procedurally with three driven hinges. Before anything was rendered, the build checked joint combinations across all three limits and every frame of the motion for framing and cable fit.",
    "tryShort": "Move the lamp through its motion.",
    "tryIt": [
      "Drag the pose slider to move the lamp.",
      "Use the buttons to jump to the four named poses and read the reach and height."
    ],
    "evidence": [
      {
        "label": "Numerical evidence",
        "note": "Reach, height and shade angle for the named poses, and the sampled ranges",
        "path": "articulation-evidence.json"
      },
      {
        "label": "Build script",
        "note": "Checks pins, link lengths, framing and cable anchors before rendering",
        "path": "build_formline.py"
      },
      {
        "label": "Motion script",
        "note": "The keyframed motion study and its checks",
        "path": "articulation.py"
      }
    ],
    "stack": "Blender 4.5 and Python",
    "tags": [
      "Blender",
      "Python"
    ]
  },
  {
    "slug": "ads",
    "group": "hardware",
    "repo": "cirrus-formline-ad-campaigns",
    "widget": "ads",
    "thumb": "assets/img/cards/ads.webp",
    "title": "Cirrus and Formline campaigns",
    "kind": "Advertising layouts composed in Python",
    "short": "Square, portrait and vertical video ads for two products.",
    "summary": "Square and portrait ads and seven-second vertical story edits for both products, composed in Python from the Blender renders and exported at platform sizes.",
    "tryShort": "Open the ads and play the two story videos.",
    "tryIt": [
      "Open any ad at full size.",
      "Play the two story videos. They are silent by design, with type kept clear of platform controls."
    ],
    "evidence": [
      {
        "label": "Render check",
        "note": "GitHub re-exports everything on every push and checks the ad sizes and video lengths",
        "path": ".github/workflows/render.yml"
      },
      {
        "label": "Layout script",
        "note": "All copy, sizes and crops in one file",
        "path": "render_ads.py"
      },
      {
        "label": "Story script",
        "note": "Timing, crop animation and a decode check for each video",
        "path": "render_stories.py"
      }
    ],
    "stack": "Python, Pillow and ffmpeg",
    "tags": [
      "Python",
      "Pillow",
      "ffmpeg"
    ]
  }
];

export const bySlug = Object.fromEntries(projects.map(p => [p.slug, p]));
export const groupOf = Object.fromEntries(groups.map(g => [g.id, g]));

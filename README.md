# VESPER: Cathedral of Ash

A gothic action RPG and dungeon crawler that runs in the browser on iPhone, Android and desktop. Fight through five floors of a ruined cathedral, each ending in a boss, with tap-based inventory, three abilities and an isometric 3D view (Three.js WebGL, with a Canvas 2D fallback). It installs as an offline web app; no account, server or app store is needed.

## Play locally

The game is static HTML, CSS and JavaScript with no build step. Serve the folder over HTTP (opening `index.html` directly won't work):

```sh
npm run dev
# then open http://127.0.0.1:3000/
```

`npm run dev` uses Python 3's built-in web server.

## Tests

```sh
npm test
```

This runs the Node unit tests for floors, enemies, equipment, abilities, graphics and bosses. GitHub Actions runs it on every pull request and push to `main`. The browser suites (`npm run test:browser` and the other `test:*-browser` scripts) need Playwright and Chromium; see [AGENTS.md](AGENTS.md) for setup.

## Project layout

- `index.html`: game loop, HUD, controls and rendering adapters.
- `*.js` / `*.css` in the root: game systems (floors, enemies, equipment, abilities, bosses, narrative) and their styles.
- `vendor/`: Three.js 0.180.0 (MIT), the only runtime library.
- `images/`, `assets/`: game artwork and asset requirements.
- `service-worker.js`, `manifest.webmanifest`, `_headers`: offline support and hosting rules. Bump `CACHE_VERSION` when runtime files change.
- `tests/`, `*.test.cjs`: browser and unit tests.
- `docs/`: screenshot galleries and historical implementation reports (`docs/history/`).
- [PROJECT.md](PROJECT.md): current design, decisions and outstanding work. [AGENTS.md](AGENTS.md): rules for coding agents.

## Licence

The code is released under the [MIT Licence](LICENSE). It does not cover the artwork in `images/`, which is all rights reserved and may not be reused without permission. Three.js in `vendor/` is MIT-licensed by its authors.

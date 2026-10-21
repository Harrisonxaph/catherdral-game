# VESPER: Cathedral of Ash

A gothic action RPG and dungeon crawler that runs in the browser on iPhone, Android and desktop. Fight through five floors of a ruined cathedral, each ending in a boss, with tap-based inventory, three abilities and an isometric 3D view (Three.js WebGL, with a Canvas 2D fallback). It installs as an offline web app; no account, server or app store is needed.

## Play locally

The game is static HTML, CSS and JavaScript; local play needs no bundler. Serve the folder over HTTP (opening `index.html` directly won't work):

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

## v0 preview, Vercel packaging and offline installation

- The current 3D/2D game stays as static files. `npm run dev` remains the local Python web server.
- Embedded or v0 preview pages do not register a service worker and direct installation to the published HTTPS site; the published app still supports offline installation.
- Run `npm run build` to copy all root runtime HTML/JS/CSS, the PWA manifest, artwork, icons and vendored Three.js into `dist/`. The build fails when HTML, service-worker or manifest assets are missing. Vercel uses this output directory as configured in `vercel.json`.
- PR #11 contained the five missing PWA icon files. Their binary blobs were reused unchanged. Existing boss, 3D, story, ability, inventory and save behaviour stays on `main`.
- Before approving deployment, inspect the Vercel preview; exercise the title screen, 2D/3D switching, new enemies, bosses, inventory and installation. Then test install/offline launch on a real phone. Github browser tests provide emulated coverage, not physical-device guarantees.

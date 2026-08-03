# AGENTS.md

Pure HTML5 Canvas game, no build tooling. All logic lives in `game.js` (single ES6+ file, no modules, no bundler). `index.html` loads it directly via a `<script src="game.js">` tag; there is no `package.json`, no test suite, no linter, no typecheck.

## Run

Open `index.html` in a browser, or `npx serve .` then visit `http://localhost:3000`. Canvas is fixed at 800×600; do not introduce a framework or bundler without intent.

## Editing conventions

- Keep everything in one `game.js` file — no module splitting, no `import`/`export`.
- Game uses toroidal (edge-wrap) space; preserve `wrap()` behavior when moving entities.
- README and code comments are in Spanish; match that language for user-facing strings and new comments.

## Verifying changes

No automated checks exist. After edits, reload `index.html` in a browser and confirm the game still starts (ship renders, asteroids spawn, controls work: ← → rotate, ↑ thrust, Space fire).
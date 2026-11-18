# Mordor, One Ring and control artwork

The user approved implementation of the two saved concepts, a themed dropdown, Gondor buttons, matching search bars, and an Alliance perimeter matching the full character frame. The existing Hobbit, Gondor, Dwarven and Elven themes remain available. Labels, connections, live states and controls stay in HTML/JavaScript; concept sample readings are never used as live data.

## Production sources

- [Mordor exact prompts and original source paths](mordor/prompts.json), exported by `scripts/prepare-mordor-theme.mjs` into `assets/themes/mordor/`.
- [One Ring prompts](one-ring/prompts.json) and [geometry notes](one-ring/README.md), exported by `scripts/prepare-one-ring-theme.mjs` into `assets/themes/one-ring/`.
- [Gondor button prompt](gondor/button-states.prompt.json), exported by `scripts/prepare-gondor-buttons.mjs` into `assets/themes/gondor/button-*.webp`.
- [Alliance controls and crest prompts](../warcraft-controls/prompts.json), exported by `scripts/prepare-warcraft-controls.mjs` into `assets/warcraft/`.
- Alliance perimeter artwork is exported by `scripts/prepare-warcraft-perimeter.mjs`; its original and exact prompt are retained under `design/warcraft-controls/`.

All new raster masters use the built-in imagegen tool. Exporters use the existing Sharp installation in the sibling Work checkout for mechanical cropping, resizing and WebP encoding. They do not edit the Work dashboard. Master PNGs and prompts are retained; runtime source hashes and geometry are recorded in manifests. The private build excludes design originals, QA files, backend sources and secrets.

Each new realm includes responsive scenery, texture, eight frame slices, independent sidebar top/fill/bottom scenery, a crest, twelve object icons, six navigation icons, six button states, idle/heating/cooling hearth states, a blank correspondence scroll and a unique footer emblem. Quiet rails repeat; corners, banners, scenery and scroll rollers keep their proportions. Both footer `<source srcset>` and fallback `<img src>` switch together.

The native `headerVisualTheme` and Settings `visualTheme` controls synchronize immediately, remember the choice in this browser, and handle unavailable storage without breaking the page. Theme overrides avoid the Treasury. The War Room's requested Alliance border and controls have independent styling across all realms.

## Verification

Run `node --test tests/*.test.js`, `node scripts/check-theme-assets.mjs` and `node scripts/build-private-site.mjs`. Browser QA covers all six choices at 1600px and 390px, actual footer `currentSrc`, dropdown synchronization and reload persistence, responsive controls, Settings width and the independent Treasury presentation. Local account feeds remain disconnected; no live Google/Nest account test is claimed by those checks.

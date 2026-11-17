# Four dashboard themes

Approved design work, November 17, 2026. The personal dashboard now provides Hobbit, Gondor, Dwarven, and Elven presentations on the existing page. The Work dashboard supplies Gondor source art and is unchanged.

`js/themes.js` restores the browser-local preference before styles render, updates the header controls and Settings selector, swaps theme-specific image sources without replacing functional DOM nodes, and synchronizes other tabs. Blocked storage still permits a temporary selection and explains that it will not persist. Invalid preferences fall back to Elven.

The original Valinor stylesheet remains the Elven dashboard. Alternate theme variables and overrides are in `css/switchable-themes.css`, `css/gondor-theme.css`, and `css/theme-craft.css`. `css/theme-home-craft.css` keeps alternate-theme home controls compact and preserves actual device states. `css/theme-sidebars.css` applies the approved White Tree and Two Trees sidebar designs. Semantic links and labels stay HTML; no screenshot is used as a functioning menu.

Scenery is optimized WebP. Material artwork, separate button states, proportional frame corners and repeating rails, true-alpha icons, and scrolls are retained as independent production assets. Each new sidebar uses separate top architecture, repeating quiet material, lower scene, crest, and six navigation icons. The scroll writing area remains inside the parchment, and mobile rollers keep their proportions.

Only decorative sources and presentation change. Credentials, account selection, sign-in, bank access, thermostat commands, and camera playback logic are unchanged. Unavailable thermostat states use unlit hearth art; no live data is fabricated. Warcraft and Treasury surfaces retain their existing presentation.

Source PNGs and exact prompts: `design/switchable-themes/`. Reproducible exporters: `scripts/prepare-switchable-themes.mjs`, `scripts/prepare-theme-craft.mjs`, `scripts/prepare-gondor-theme.mjs`, and `scripts/prepare-themed-sidebars.mjs`. `scripts/check-theme-assets.mjs` verifies every new stylesheet and runtime icon reference exists. Private build packaging excludes masters, prompts, QA, credentials, and server source from browser assets.

Release validation: all 193 automated tests pass; 107 new stylesheet/runtime asset references resolve. Browser checks at 1600px and 390px cover all four themes without horizontal page overflow or missing theme images. Settings changes immediately select the theme and the selection survives reload; the 390px dialog has no horizontal overflow. Alternate theme switching leaves every sampled Warcraft and Treasury descendant's image source, background, border artwork, color, font, and padding identical to the Elven baseline. Actual Google/Nest account connections were not exercised from the local preview.

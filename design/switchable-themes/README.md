# Switchable Hobbit and Dwarven artwork

The user approved the two dashboard mockups on November 17, 2026. The built-in imagegen tool generated clean production scenery, transparent panel frames, and twelve-icon atlases from those mockups as style references. Original PNGs in the theme subfolders are retained unchanged. Exact generation prompts are supplied by the owning build task.

`scripts/prepare-switchable-themes.mjs` prepares the browser assets in `assets/themes/hobbit/` and `assets/themes/dwarven/` with the existing sibling Work checkout's Sharp dependency. Re-run with Node from any working directory. It uses the retained originals when present; the Codex generated-images directory is only a first-run source fallback. No credentials or runtime service data are involved.

Each theme has four optimized scenery WebPs, eight lossless RGBA panel-frame slices, and twelve proportional lossless RGBA icons. The atlases are 1448 × 1086, exactly four columns by three rows of 362 × 362 cells. Icon order is calendar, home, provisions, raven; orb, news, tools, compass; weather, camera, refresh, settings.

Frame source corners are 220 × 220. Render corners at 50 × 50 CSS pixels. Horizontal rail sources are 300 × 220: repeat at 68.182px × 50px. Vertical rail sources are 220 × 200: repeat at 50px × 45.455px. Corners remain proportional; only quiet straight middle rails repeat. The frame's center is truly transparent, verified from its alpha channel. Soft alpha edge light is retained rather than flattened onto a matte.

The backgrounds derive from their theme's scenic header so the environment remains coherent. Genuine service logos remain the existing dashboard assets. Theme manifests record source hashes, crop dimensions, output sizes, byte counts, and alpha presence. Additional control artwork is listed below; CSS keeps labels and interaction states accessible.

## Additional crafted surfaces and scrolls

`scripts/prepare-theme-craft.mjs` exports the additional approved imagegen artwork. Each Hobbit and Dwarven theme now also has a 512 × 1536 sidebar, a 512 × 512 material texture, six separate button plates, three hearth states, and a 1280 × 1280 parchment scroll. Gondor receives its own silver and slate parchment scroll. Existing scenery, frame slices, and icons are retained.

Button source atlases are 1774 × 887 in a three-column, two-row grid. The exporter uses rounded cell boundaries, crops each plate to its alpha bounds with a four-pixel safety margin, and resizes proportionally to 600px wide. Hobbit plates are 249–251px tall; Dwarven plates are 229–231px tall. Hearth atlases are 2172 × 724, with three 724px cells; isolated hearth idle, heating, and cooling artwork fits inside 288 × 288. Button and hearth exports retain lossless alpha. CSS provides labels, focus outlines, and the interaction behavior over these plates.

All scroll masters are 1254px square and exported as 1280px square WebP at quality 90 with alpha intact. Desktop can use the complete square artwork; mobile may stretch only the writing area with `border-image-slice: 250 0 250` and matching top and bottom roller widths. The written content must stay inside the quiet parchment interior. Separate `craft-manifest.json` files record source hashes, exact alpha crop boxes, dimensions, byte counts, and output hashes. Original PNGs stay unchanged beside the earlier source masters.

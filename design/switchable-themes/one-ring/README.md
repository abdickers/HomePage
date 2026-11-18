# One Ring production assets

Seven production masters were generated with the built-in `image_gen.imagegen` tool using the approved `design/mordor-one-ring-concepts/one-ring-concept.png` as a style reference. Exact prompts and generated source paths are in `prompts.json`; all original PNGs are retained unchanged in this directory.

The visual language uses near-black stone and leather with polished true yellow gold, a physical Ring, fine chain, journey-map artwork, and flowing line ornament. It is distinct from the Dwarven theme's bronze and geometric relief.

Run `node scripts/prepare-one-ring-theme.mjs` from the personal checkout to reproduce `assets/themes/one-ring/`. The exporter uses the existing sibling Work checkout's Sharp dependency without changing that checkout. It mechanically crops, resizes and exports approved art, retaining alpha rather than flattening to a matte. It never uses the concept screenshot as live interface content.

Invisible alpha-channel noise at values 1–3 is normalized to true zero after resizing; visible antialiased edges and all source masters are retained.

The browser assets include two header sizes, two background sizes, material texture, eight frame slices, a full sidebar and three proportional sidebar pieces, a Ring crest, twelve functional icons, six navigation icons, a unique Ring footer emblem, six button states, three hearth states, and a parchment correspondence scroll.

Frame artwork is cropped to its physical alpha bounds and resized proportionally to 1024px wide before slicing. This keeps the long gold corner loops intact inside the standard 220px square corner cells. Render corners at 50px; horizontal rail tiles are 300 × 220, rendered at 68.182px × 50px; vertical tiles are 220 × 200, rendered at 50px × 45.455px. Only quiet middle rails repeat.

Sidebar top, fill and bottom retain full-width art at 512px. The bottom starts at source y1160 to include the complete large lantern, Ring, map, chain and book still life. Render top and bottom at `100% auto`; only the quiet center strip repeats. The texture comes from the quiet central leather area without frames or objects.

The scroll is 1280px square with alpha outside and blank opaque parchment inside. Its top ornament and roller extend about 290px from the top; its bottom roller and chain occupy about 270px. Those are the suggested mobile border-image slices so roller artwork remains proportional. The writing area must stay within the quiet parchment interior. All labels, values, focus rings, actions and data stay in HTML/CSS/JavaScript.

`assets/themes/one-ring/manifest.json` records source hashes, precise crop geometry, output dimensions, byte counts, alpha presence and content hashes.

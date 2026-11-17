# Gondor theme sources

This theme reuses the Work Command Center's Royal Gondor assets and final dark
palette from `work-homepage-refresh/app/royal-gondor.css`.

- `header.webp`: the original 1600px Royal Court at twilight; also the page scene.
- `white-city-daylight.webp`: the original 960px White City daylight variant.
- Silver corners, rails, White Tree crest, diamond and sidebar divider: original
  `work-homepage-refresh/public/art/gondor/` slices.
- Dimensional icons: original `public/art/royal-gondor/icons/` families; mail
  raven comes from `public/art/polish/raven.webp`.
- Settings and refresh: native Work SVGs, with a fixed silver stroke so the
  external image has the same color as the Work inline rendering.

`scripts/prepare-gondor-theme.mjs` reproduces all copies and records source paths, sizes and hashes in
`manifest.json`. No raster artwork is recolored, regenerated, or upscaled.

The palette is midnight blue and silver: ink `#e8edf2`, muted `#b2bfcc`, accent
`#b8c9d8`, panel `#19232e`, alternate panel `#202e3a`, and field `#111c27`.
The Work site itself is not modified.

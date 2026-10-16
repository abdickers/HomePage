# Visual redesign handoff

Implemented locally on `codex/visual-realm-overhaul`. This task prepares a preview;
it does not publish GitHub Pages or deploy the private Worker.

## Scope and integration

- `index.html`: decorative images, presentational wrappers, heading treatment,
  Treasury naming, a trimmed copy of the existing Frear portrait, and one new CSS
  import. All 134 original IDs and 27 original links remain. The hero/header HTML
  is identical to the starting revision, and its original styles are unchanged.
- `css/epic-realm.css`: scoped visual components and responsive layout. Existing
  theme styles stay intact. New styles primarily live under `.realm-dashboard`.
- `assets/redesign/originals/`: all seven supplied PNGs, byte-for-byte verified
  against the supplied SHA-256 manifest, plus the unchanged existing public
  Blizzard portrait used by the page before this redesign.
- `assets/redesign/`: alpha-preserving WebP crops, frame sheets, and icons, with
  measured bounds and dimensions in `derivative-manifest.json`.
- `scripts/prepare-redesign-assets.py`: reproducible Pillow asset preparation.
  Run from the repository root with `python scripts/prepare-redesign-assets.py`.
  Optional derivative names restrict regeneration to those outputs.
- `design/asset-pack/`: original handoff guides and manifest retrieved from the
  user's Command Center folder in Google Drive.

No JavaScript widget, backend, authentication, bank, email, Nest, or data-sync
module was modified. Keep these presentation changes separate when integrating
other budget work. All current connection settings and private data stay in the
existing services; this change contains no provider credentials or private mail.

## Reusable components

`art-frame elven-frame` and `art-frame vault-frame` decorate the outside of an
ordinary panel. Generated nine-slice sheets use 360px and 320px native corner
slices respectively. Quiet rail patches repeat instead of stretching central
leaves, gems or hammers. The Dwarven top gem is a separate fixed-size ornament.
The center is transparent and all financial content remains normal HTML.

`parchment-scroll` combines proportional 180×176px roller ends with a repeating
quiet roller center. Fixed paper edges flank a repeating 256×128px paper tile.
The bottom roller reflects the clean top roller, avoiding a cut-off quill or an
opaque square source crop over controls. Small spatial fades blend only the
quiet roller seams. No dark-pixel removal, color-keying, or global alpha cleanup
was used. Original artwork is preserved, including raven feathers and stone.

The atlas uses 12 individually measured bounds. Three spatial isolation polygons
remove neighboring fragments from the shield, weather and book crops. These
were checked together on the real dark panel color; the retained silhouettes
remain complete. Every exported derivative's encoded alpha was compared with
the prepared image and verified unchanged by WebP encoding.

Decorative images are empty-alt, screen-reader-hidden, and noninteractive.
Below-fold decorative images use lazy loading and explicit dimensions. Shared
frame/texture files are CSS assets. Keyboard focus is visible; the new visual
layer disables transitions and animations under reduced-motion preferences.

## Native resolution and limitations

| Supplied original | Actual pixels |
| --- | --- |
| Elven panel frame | 1536×1024 |
| Section icon atlas | 1254×1254 |
| Ravens email scroll | 1223×1286 |
| Gondor White Tree crest | 1024×1536 |
| Dwarven vault frame | 1254×1254 |
| Hobbit Bag End door | 1254×1254 |
| Alliance portrait frame | 1024×1536 |

These are the native assets supplied in the pack, not 2K/4K masters. The icon
atlas contains small individual icons, not twelve large standalone illustrations.
No interpolation was used to manufacture higher source resolution.

Frear's existing 1600×1200 PNG has nonzero-alpha bounds `(541,406,1056,985)`.
The derivative crops to `(525,390,1072,1001)`, retaining a 16px safety margin and
every source pixel belonging to the full character. It is 547×611px. The new
portrait frame displays at up to 460 CSS px wide; the character fills roughly
70% of its inner opening height without cutting off head, boots or weaponry.
The frame has enough native pixels for that display at 2×; the original character
has less than full 2× pixel density at the largest desktop size. A truly sharper
large portrait would require a higher-resolution authentic character source.

All seven supplied assets are present and used. No separate quest-card texture
or Ironforge background was supplied; those surfaces use CSS, as the guide
requests. Existing service logos, source links and live video HTML are retained.

## Validation

- Buildless project: no bundler/build step required. JavaScript syntax check and
  all 87 existing Node tests pass.
- Rendered at 390×844, 768×1024, 1440×1050, and 1920×1080. No page-level horizontal
  overflow. Financial tables retain their explicit internal horizontal scrollers.
- Inspected header, Calendar, parchment, Bag End, Treasury, War Room, and compact
  tools/navigation. Checked icon crops and translucent halos on dark backgrounds.
- Tested the original Calendar navigation, Add Link dialog, Retail/Forever
  keyboard switch and source links. Focus remains visible.
- Used the unchanged mail and budget rendering modules in a clearly labeled
  local fixture with synthetic long messages, obligations, and thermostat controls.
  Private views were not copied into screenshots or committed as example data.
- Confirmed amounts start hidden, Show/Hide still works, and editor-only reveal
  leaves the dashboard masked. The editor fits at 390px and 768px.
- Representative normal-text color pairs meet WCAG AA: dark-panel body 14.46:1,
  muted dark-panel body 9.68:1, parchment body 10.86:1, parchment metadata 6.20:1,
  quest-journal body 5.71:1 and quest labels 5.67:1. Artwork texture varies; controls
  and text sit on quiet interior surfaces away from ornaments.

Local preview: `python -m http.server 4180 --bind 127.0.0.1`, then open
`http://127.0.0.1:4180/`. The ignored `qa/` directory contains screenshots and the
synthetic visual fixture. Local previews do not establish new live Google, Nest,
or bank connections; those remain governed by the existing authorized origin.

# Gondor header and divider

Personal HomePage only. The original landscape, wizard, Palantir, sidebar links,
and every section theme remain. `css/gondor-header.css` contains the scoped
presentation; `js/wizard-disclosure.js` adds an ordinary disclosure with normal
Tab order, outside-click/focus dismissal and Escape restoration.

Settings, Account and Mail keep their original elements, IDs, handlers and
destinations. The former wizard link is retained as ChatGPT in the disclosure.
Theme is absent from the header/menu; stored theme restoration and the optional
toggle binding remain in app.js. No provider/backend modules or configuration
changed.

## Artwork and geometry

Unchanged PNGs are in `assets/gondor/originals/`: header 2172×724 RGBA and rail
724×2172 RGBA, native supplied sizes. The private build excludes these sources.
`scripts/prepare-gondor-assets.py` generates 13 lossless WebP slices (361,996
bytes total) and `assets/gondor/slice-manifest.json`, including source hashes,
alpha bounds and exact half-open crop coordinates. Decoded derivative alpha
is asserted identical to each source crop. No pixels are recolored or globally
removed. Re-run with Python/Pillow after intentionally replacing the sources.

Reviewed source grids/corner crops determined the top rail at y90–140, bottom
rail at y625–675 and independent White Tree crop at [970,0,1202,160]. Fixed
145px square corner crops display at 40px (30px mobile); plain spans alone
extend. The 56px crest (44px mobile) retains its aspect ratio and projects above
the top rail. The landscape lives on a separate inset, rounded surface, while
the header stays overflow-visible for the menu and keyboard focus.

The page rail uses a proportional top, plain shaft and proportional bottom;
the optional middle diamond is omitted. Its center replaces the removed sidebar
border at x190 desktop/x164 tablet. The 28px/20px cap fits within the sidebar's
existing trailing padding and adjacent gutter without touching labels. It spans
the body's natural content height, with a 20px bottom clearance, and is hidden
with the collapsed mobile sidebar. Decorations are aria-hidden and noninteractive.

## Verification

- Rendered 375, 768, 1440 and 1920px layouts; checked menu placement, readable
  live text, fixed crest proportions, seams/alpha over the existing landscape
  and forest, background containment, and absence of horizontal overflow.
- Viewed the full-height rail's bottom cap at the actual document end, beyond
  Treasury/Words of Wisdom/footer. Original sidebar border computes to 0px;
  the new rail center matches that boundary exactly.
- Enter and Space open; Tab reaches Settings then Account/Mail/ChatGPT; Escape
  closes and restores trigger focus. Outside click closes. Closed menu is skipped
  by Tab. Settings opens its existing Connections tab and restores focus to the
  visible wizard trigger after closing, rather than the hidden Settings item.
- Dashboard search returned the existing Google Calendar shortcut; Web provider
  selection, Bag End and sidebar Warcraft navigation were exercised. Ask AI was
  activated with an empty query; the in-app browser did not expose a new tab,
  so its external window was not end-to-end verified. Its handler is unchanged.
  Account/Mail URLs retain the personal authuser selector; no new consent or
  private provider action was performed for this visual change.
- Browser zoom shortcuts left innerWidth/DPR/visualViewport scale unchanged.
  Native 200% zoom could not be verified; the equivalent 720×500 CSS-pixel
  reflow was tested, including the open menu (within the viewport).
- All 128 existing tests and browser-module syntax checks pass. No constant
  animation added. The release also runs the allowlisted private build and
  strict Wrangler dry-run before the repository PR/CI workflow.

Screenshots and local diagnostics are in ignored `qa/gondor-*` files. Private
release verification is recorded separately after deployment.

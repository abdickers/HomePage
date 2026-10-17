# Warcraft borders — October 16, 2026

## Scope

Only Frear's War Room presentation changes. `index.html` adds the scoped section-frame decoration and stylesheet, and updates the Warcraft module cache version. `js/wow.js` adds a reusable `warcraft-story-frame` class and one assistive-technology-hidden decoration to the existing common story template used by both modes. All provider, countdown, stale-state, refresh, link and edition-switching logic is unchanged.

`css/warcraft-frames.css` replaces the old outer outline with the supplied Alliance architecture. The existing separate portrait frame and authentic character image remain unchanged and generously sized. The story frame uses the existing parchment surface inset behind its inner rails, with dark ink. Decorative layers ignore pointer input; keyboard focus paints above them with room inside the scroll container. No animation was introduced.

## Artwork

Both original PNGs in `assets/warcraft/originals/` are the supplied 1536×1024 RGBA files, with fully transparent centers. Their SHA-256 values and dimensions are recorded in `assets/warcraft/derivative-manifest.json`. No original pixels are modified and no dark-pixel keying or alpha threshold is used.

`scripts/prepare-warcraft-assets.py` creates four delivery derivatives totaling 232,150 bytes. WebP alpha is checked against the composed/cropped source image on save and survives the encoder exactly.

- Outer frame: fixed 336px square source corners, quiet mirrored rails, an empty center, and separately cropped centered lion and lower seal. The CSS frame cells are 72px on desktop and 48px on mobile; the lion is 144px/108px wide at its original aspect ratio.
- Story frame: fixed 216px source corners and quiet rails, rendered in 36px/30px cells. The actual gem ornaments occupy roughly 20–30px and iron rails roughly 4–8px. Short cards and tall sections never stretch the complete original bitmap.
- Original alpha edges and translucent pixels were composited and inspected on the actual slate and parchment backgrounds. No pale halos, obvious seams, or distorted lion/gem shapes were found at the tested sizes.

## Validation

- 105 project tests pass; application and Warcraft module syntax, asset script syntax, and `git diff --check` pass. This is a buildless site.
- All 156 original IDs and 27 static link destinations remain. A normalized comparison verifies markup outside Warcraft is unchanged. The Warcraft controller differs only in story decoration markup.
- Retail and Forever were rendered and visually inspected at approximately 390, 768, 1440, and 1920 CSS pixels, including short and deliberately long synthetic titles/summaries. All eight checks show no horizontal page overflow, one frame per story, initial story-list scroll position zero, and the complete first card inside the visible list area.
- A local ignored fixture uses the actual Warcraft controller. Verified both switches, active/upcoming/date labels, refresh, stale warnings, failed-refresh preservation, and keyboard focus from Refresh to the first card. The focus outline is 3px with a 3px offset and remains unclipped inside the list padding.
- The actual homepage entry point was also inspected with its existing public Warcraft feed. The local synthetic fixture, screenshots and verification JSON are ignored and not published.

No missing supplied artwork or unresolved material visual issues were found in this verification. Private Google, bank and Nest authorizations were not restarted for this presentation change. No backend deployment is part of it.

# Apply the new Warcraft borders

Inspect the existing homepage repository and follow its instructions. Preserve uncommitted work and all working integrations. Apply these two supplied artworks to Frear's War Room only.

## Assets
- assets/wow-section-border.png: bold lion-crested Alliance frame for the OUTER boundary of the entire Warcraft section, enclosing heading, Retail/Forever controls, Frear portrait and news/events.
- assets/wow-news-card-border.png: lighter blue-gem iron-and-gold frame for EACH individual Warcraft news/event story card in both modes.

Both original PNGs are 1536x1024 RGBA. Their center pixels are fully transparent. Preserve originals; do not describe them as 4K masters. Inspect translucent edge halos over the actual backgrounds before shipping. Do not globally erase dark pixels: dark iron is intentional.

## Implementation
1. Locate existing Warcraft section and story-card components. Add reusable scoped WarcraftSectionFrame and WarcraftStoryFrame wrappers, or equivalents appropriate to the stack. Leave financial, email, Nest, and other section styling untouched.
2. Copy originals to stable public asset paths. Produce optimized alpha-preserving WebP derivatives for delivery if supported. These are border overlays; keep existing live content as HTML underneath.
3. Build responsive borders from fixed corners and flexible rails. Inspect actual pixel positions before selecting slice boundaries. Use nine-slice border-image only if it preserves the lion and ornament proportions; otherwise extract corners, rails, and central lion crest separately, using positioned decorative layers. Keep the lion centered and undistorted as the section changes height. Do not stretch the complete 3:2 bitmap to fit a tall section or short card.
4. Replace the existing plain outer Warcraft outline with the major frame. Retain the original separate Alliance portrait frame and authentic Frear image. Do not nest the new section frame around the portrait alone. Keep Frear generously sized.
5. Apply the lighter frame to every Warcraft story card, not to each text line or button. Keep fixed corner details roughly 20–30px and rails roughly 4–8px on desktop; tune after visual inspection. Outer section corners can be roughly 48–72px with 12–20px rails. These are design targets, not source crop coordinates.
6. Reserve sufficient inner padding: start around 40–56px for outer section and 24–32px for cards, adjusting for actual artwork bounds. Keep heading and controls below the lion crest. Use smaller ornaments on mobile without reducing readable text or tap targets.
7. Keep cards content-driven, with readable headings, summaries, dates, Active/Upcoming status, thumbnails where already supplied, and links. Preserve existing parchment/dark surface choice if contrast works. Dark ink belongs on light parchment; ivory on dark slate. Avoid redundant nested border outlines.
8. Decorative layers must use pointer-events:none and be hidden from assistive technology. Keep keyboard focus visible above frames. Never clip focus rings, title text, card content, or scrolling controls with overflow rules.
9. Preserve Retail/WoW Forever switching, refresh, live feeds, countdowns, stale-data warnings and links. No backend changes. Avoid constant animation; a restrained hover highlight is optional and must respect reduced motion.

## Verify
Run relevant project build/checks. Visually inspect at 390px, 768px, 1440px and 1920px widths, including both modes and cards with short/long titles. Verify no distorted lion or gems, frame seams, horizontal overflow, obscured content, clipped focus or broken scroll areas. Confirm the first story card is completely visible at initial scroll position. Share a concise summary of changed files, checks and any unresolved issues. Follow existing deployment authorization; do not claim a deployment without verification.

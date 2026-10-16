# Placement and visual system

## Keep the hero
Preserve the current Rivendell landscape header, greeting, title, search, and account controls. It is the visual anchor. Carry forest green, muted antique gold, and warm ivory below it. Body text should be ivory on dark panels; reserve gold for headings, borders, and emphasis. Use readable sans-serif body text and existing elegant serif headings.

## Asset map
| File | Section | Use and approximate desktop size |
|---|---|---|
| elven-panel-frame.png | Calendar; restrained accents on AI Tools and Words of Wisdom | Fixed-size corners 40–64px with flexible rails. Never stretch the entire ornament to fill arbitrary boxes. |
| ravens-email-scroll.png | The Ravens / email | Main parchment surface. Dark brown live text; raven icon at heading. Build separate top roll, quiet middle, and bottom roll if the wide layout needs it. |
| gondor-white-tree-crest.png | Tools & Systems, with smaller repeat at Quick Access | One 72–112px-tall crest beside heading; silver/charcoal styling. Keep useful service logos. |
| dwarven-vault-frame.png | New budget panel: The Treasury | Stone/bronze frame, coin-pouch heading icon. Use responsive corner/edge slices; no artwork behind numbers. |
| hobbit-bag-end-door.png | Bag End / home controls | 160–240px-wide welcoming emblem beside section heading or thermostat. Green/oak/amber accents. Keep live camera rectangular and prominent. |
| wow-alliance-portrait-frame.png | Frear's War Room, portrait only | 320–460px-wide portrait frame. Scale/crop existing character image's empty margins so Frear fills roughly 70–80% of the inner opening height without clipping his head or feet. |
| section-icon-atlas.png | Section headings and small navigation accents | Extract icons visually; generally display at 40–64px, sidebar 24–32px. Do not render the entire atlas as one icon. |

## Icon atlas order
Four columns, three rows, left to right:
1. Calendar parchment → Calendar; raven → email; green door → compact Bag End navigation; hearth → thermostat.
2. Provisions crate → Quartermaster; shield/weapons → War Room; coin pouch → Treasury; blue orb → AI Tools.
3. News scroll → News; sun/cloud → Weather; book/quill → Words of Wisdom; key → Quick Access.

Atlas layout is approximate, not a mathematically perfect sprite grid. Inspect bounding boxes; some feathers, rays, and quill edges approach neighboring cells. Preserve full silhouettes and transparent margins. Use the existing separate door file for the larger Bag End art.

## Email: the most important transformation
Make the Ravens panel feel like a readable letter on parchment. Warm ivory center, dark ink text, muted bronze separators, burgundy wax unread markers plus a text label/bold weight. Keep sender, subject, preview, timestamp, and open action as selectable accessible HTML. Avoid repeating a whole scroll around every email. On desktop, keep the email panel generously wide, and use one clear list or two columns only if subjects remain readable. Keep controls off the rolled edges. Use 48–64px inner padding on desktop and 24–32px on mobile, adjusted after actual slices are measured.

The source is nearly square. Never squash it into a wide banner. Separate end caps and middle parchment or use proportional decorative overlays on an opaque matching parchment CSS surface. Validate texture seams and contrast. Long lists may scroll inside a clearly bounded middle region; no scroll traps.

## Bag End and Quartermaster: Hobbit warmth
The door should welcome the user, not become a background behind controls. Place hearth icon near the thermostat temperature. Preserve the usable camera area and all Nest controls. Quartermaster gets oak/green accents and the provisions-crate emblem, with Amazon and Walmart logos and actions remaining recognizable. Compact empty receipt states; avoid tall empty boxes.

## Gondor: order and navigation
Tools & Systems and Quick Access share silver, charcoal, and restrained White Tree heraldry. One main crest is enough. Align service cards into a clean responsive grid. Reduce the large empty area currently underneath tool cards instead of stretching the row to match a taller neighbor.

## Treasury: Dwarven craftsmanship
Use the Dwarven vault frame around the outer finance section only. Inside: simple quiet panels for balances, upcoming bills, and spending. Keep finance privacy controls and actual Plaid sync status. The name can be 'The Treasury' with 'Budget & bills' as a plain-language subtitle. Do not change finance logic during visual work.

## Warcraft: a distinct Alliance zone
Make this section feel like World of Warcraft: Ironforge stone, chunky beveled iron/gold, royal blue accents, amber forge highlights. Use the new frame on Frear's portrait and keep the authentic existing character art. Keep both Retail and WoW Forever controls and data behavior.

The event area should resemble a quest journal: parchment-toned event cards, readable dark text, compact metal edges, explicit Active/Upcoming labels, and distinct focus/selected states. Use CSS for these surfaces; no separate quest-card or Ironforge background artwork is supplied. Do not apply the Elven vine frame throughout Warcraft. Keep event cards and character large enough to read, not a tiny figure in a giant box.

## Page rhythm and responsive behavior
Suggested order: existing hero → Calendar + Ravens → Bag End → Treasury → Quartermaster + AI Tools → War Room → Tools + Quick Access → News + Weather → Wisdom.
Preserve established navigation anchors. If the existing finance work has an agreed placement, integrate rather than moving it blindly. Use content-driven heights, 24–32px desktop gutters, and 16px mobile gutters. Major sections get ornaments; inner cards get simpler borders. On phones stack columns and reduce decorative scale, not readable font sizes.

## Resolution and rendering
Original dimensions are in asset-manifest.json. For a crisp 2x display, target at most half the native pixel width/height when using a whole asset. The 1024px portrait frame is suitable at roughly 460–512 CSS px wide at 2x. Use slices for wide frame sections and scrolls instead of enlarging entire bitmaps. If a full-width 2x surface requires more real pixels, request a new larger source; simple interpolation does not add detail.
Preserve originals; create alpha-preserving optimized WebP derivatives locally in the site. Lazy-load below-fold decorative art, reserve dimensions, avoid repeated full-size atlas downloads, use empty alt text for purely decorative images and pointer-events:none for overlays. Respect reduced motion. No constant spark/particle effects.

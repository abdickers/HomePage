# Gothic Victorian Steampunk

The user approved the dashboard concept and requested it as a selectable theme, including real moving gears and the existing theme-family rules. The email artwork was corrected to a physical rolled parchment scroll at the user's request.

Eight production images were generated with the built-in image_gen tool, using `dashboard-poc.png` as a style reference. `prompts.json` retains the exact prompts, source paths and revision history. The original `scroll.png` letter-board design is retained for provenance; `scroll-v2.png` is the actual production scroll. The concept screenshot is never used as live interface content.

Run `node scripts/prepare-steampunk-theme.mjs` from this checkout to reproduce `assets/themes/steampunk/`. The exporter reuses the installed Sharp dependency from the sibling Work checkout without changing that project. It retains source masters, proportionally crops and optimizes WebP exports, normalizes invisible alpha noise, and writes hashes, dimensions, sizes and source geometry to `manifest.json`.

The family contains responsive header/background art, dark damask material, eight frame slices, proportional sidebar caps/fill, crest, footer, twelve functional icons, six navigation icons, six control states, three climate states and its own correspondence scroll. Panel rails use the shared continuous-material rules; corners and illustrated objects remain proportional. Genuine service logos, Warcraft and Treasury retain their existing artwork and controls. All text, values and actions remain live HTML.

The email scroll has brass and mahogany rollers, a mechanical raven and blank parchment. The desktop reading area starts below the upper roller. Mobile uses 360/200px top/bottom source slices on the 1280px export; only quiet parchment stretches. The existing email tabs, refresh action, connection status and list remain inside the paper.

Two centered SVG wheels are generated from explicit 24/16-tooth geometry with matching pitch. CSS rotates them in opposite directions at 72/48-second periods. Decorative assemblies are created once, only after selecting Steampunk; they cannot intercept input and are hidden from assistive technology. CSS honors reduced motion. Page visibility and intersection observers pause hidden/offscreen wheels; switching to another theme disables the animation.

Local validation covers all seven theme choices, both synchronized menus, saved selection after reload, same-origin tab synchronization, unchanged protected artwork, actual changing gear transforms, offscreen pausing and responsive widths of 1440, 390 and 320px. The local preview does not establish an authenticated Gmail or Nest connection.

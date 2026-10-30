# Two Trees of Valinor / High Elven artwork

Design pass, October 29, 2026. Generated using the built-in image generation tool; exact prompts are in `prompts.json`.

## Confirmed scope

The new direction applies to the personal dashboard header, page background, sidebar/navigation, Calendar, Ravens, AI tools, Bag End, provisions, Android apps, news, Tools & Systems, Settings, and their ordinary controls.

**Preserve Frear’s War Room and Open the Treasury, including their artwork, borders, colors, icons, controls, and expanded Treasury workspace.** The work dashboard is a reference only and remains unchanged.

This folder is artwork for review. It does not change the live dashboard. `concept-scoped.png` is the current concept; `concept-board.png` is the earlier exploratory version and its Treasury treatment is superseded by the preservation requirement.

## Asset inventory

| File | Purpose |
| --- | --- |
| `concept-scoped.png` | Current concept with only sections included in the new theme |
| `header.png` | Panoramic 2172 × 724 scenic header, quiet left area for HTML content |
| `background.png` | 1672 × 941 full-page environment with calm lake center |
| `panel-frame-v2.png` | Preferred silver/gold leaf frame with moonstones, transparent center |
| `panel-frame.png` | Earlier frame variation |
| `navigation-divider.png` | Tall double-tree divider with extensible quiet shaft |
| `icons-atlas.png` | Twelve visual icons in a 4 × 3 grid |
| `buttons-atlas.png` | Six button states in a 3 × 2 grid |

Icon order: calendar/overview, home, provisions, raven/mail; seeing orb/AI, news scroll, tools, compass; weather, camera, refresh, settings. Warcraft and Treasury are intentionally absent from the replacement icons.

Button order: primary normal, hover, pressed; secondary normal, hover, disabled. Add accessible HTML text over the plates during implementation.

Palette: moon silver `#D7D9E4`, tree gold `#D7B575`, ivory `#E6DCCC`, twilight `#17243B`, muted sage `#858979`.

Before implementation: export individual icon and button cells, optimize responsive scenery variants, prepare repeatable rail/frame slices, and verify alpha edges over contrasting backgrounds. Keep panel fills inset beneath the physical frame; never apply the full frame rectangle as an opaque background. UI content in the concept artwork is illustrative and must be replaced with the dashboard’s existing real functionality.

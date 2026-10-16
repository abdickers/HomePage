# Placement and interaction plan

| Asset | Placement | Behavior |
|---|---|---|
| treasury-hidden-mine-door.png | Compact gateway card at budget section location | Entire card is a real button labeled Open the Treasury; click reveals budget. |
| lonely-mountain-treasury.png | Expanded budget section backdrop | Dark overlay plus opaque/near-opaque financial cards keeps values readable. |
| bree-prancing-pony-news-board.png | News section background | Live headline cards styled like pinned parchment notices over the central board. |
| hobbit-oak-ivy-frame.png | Bag End outer section frame | Fixed decorative corners, flexible oak rails; keep ornament away from controls. |
| hobbit-home-icon-atlas.png | Small Bag End subheadings | Gate for camera, lantern for existing lights, key for existing access, window for climate, basket for household supplies. Do not add unsupported device controls. |
| hobbit-heating-fireplace.png | Thermostat mode illustration | Confirmed HEAT mode; also AUTO mode when HVAC is actively heating. |
| hobbit-cooling-open-window.png | Thermostat mode illustration | Confirmed COOL mode; also AUTO mode when HVAC is actively cooling. |

## Thermostat states: mode versus activity
The user specifically wants a fireplace in heating MODE and an open window in cooling MODE. Use the latest confirmed device data, not an unsaved dropdown selection. Normalize provider values using the existing integration's actual schema; do not assume field names. Keep reported ambient temperature, target temperature(s), humidity and all controls intact.

| Confirmed mode | Reported activity | Illustration | Visible state text |
|---|---|---|---|
| HEAT | Heating | Fireplace | Heat mode · Heating now |
| HEAT | Idle | Fireplace, no extra animation/glow | Heat mode · Idle |
| COOL | Cooling | Open window | Cool mode · Cooling now |
| COOL | Idle | Open window, no extra animation/glow | Cool mode · Idle |
| HEATCOOL / AUTO | Heating | Fireplace | Auto · Heating now |
| HEATCOOL / AUTO | Cooling | Open window | Auto · Cooling now |
| HEATCOOL / AUTO | Idle or unavailable | Neutral existing temperature glyph | Auto · Idle, or Auto · Activity unavailable |
| OFF | Any | Neutral existing temperature glyph | Off |
| Unknown/disconnected | Unknown | Neutral existing temperature glyph | Status unavailable |

In a fixed HEAT/COOL mode with unavailable activity, retain the mode illustration but label activity unavailable. If stale data is retained, explicitly show last known mode and stale timestamp; never imply current operation. Do not show the burning fireplace for OFF. Do not infer a mode from temperature, weather, or last selected icon. If provider mode/activity conflict, retain confirmed mode and show activity separately without pretending certainty.

Keep art in a fixed 112–144px-wide desktop slot (80–96px mobile), object-fit:contain; temperature remains large readable HTML beside it. Art has no independent action; mode changes still use existing controls and confirmation/error behavior. Both images are high enough resolution for these sizes. Use empty alt when adjacent text states mode and activity. Avoid repetitive live announcements.

## Hidden mine entrance
Budget starts collapsed, showing the closed door and a clear Open the Treasury label. Keyboard focus and hover can reveal a restrained amber seam glow. Click/Enter/Space reveals the treasury panel via 200–350ms crossfade; reduced-motion users get an instant transition. Use aria-expanded and aria-controls. On collapse, return focus to the entrance if it was inside the removed content. Add a clearly labeled Close Treasury control.

Never load two overlapping interactive copies of the budget. Hidden contents must not remain tabbable. Retain existing authenticated APIs, owner authorization and privacy controls. The decorative hidden door is a disclosure control, NOT security or authentication. Never log or leak financial values in HTML attributes or decorative images. No finance backend redesign is part of this art task.

Gateway suggested width 320–480px; avoid consuming an entire desktop screen with a closed door. Expanded treasury uses the interior image behind cards and, where already available, the original Dwarven outer frame. Do not repeat the scenic image per small card. Title: The Treasury, subtitle Budget & bills.

## Bree news
Title: News from Bree; optional subtitle The Prancing Pony noticeboard. Keep source tabs, refresh, source links, timestamps, and the real news feed. Place light parchment cards over the central wooden area, dark ink text and clear links. Keep the pony sign and lantern visible at desktop sizes. At mobile widths use the artwork as a shallow header with cards below on dark wood color rather than crushing articles into a tiny illustrated board. Existing news filtering must remain functional.

## Bag End
Use the oak-and-ivy frame for the outer section only; inner controls get simpler green/bronze borders. Retain earlier Hobbit door emblem if already installed, at a modest scale, to avoid duplicating giant doors. Use camera gate icon beside Watch the gate. Keep camera video rectangular and unobstructed. Lighting/key icons decorate existing supported functionality only. Atlas is approximately 3 columns by 2 rows: fireplace, gate, lantern / key, round window, basket. Extract visually checked bounds, not blind crops. The new OPEN window and standalone fireplace supersede the atlas versions for thermostat mode.

## Production rendering
Preserve source PNGs. Make optimized alpha-preserving WebP derivatives and small responsive icon variants. No fake 4K claims; do not upscale and claim new detail. Use native dimensions in manifest for display budgets. Scenic wide images may not provide true 2x pixels at full desktop width; use them as atmospheric subdued backgrounds, not sharp text-bearing artwork. If more resolution is essential, request higher-resolution generation.

Slice frame corners/rails after visual inspection. Avoid stretching lanterns, flowers or carved leaves. Inspect alpha halos over dark and light surfaces; never remove all black pixels because dark material is intentional. Reserve dimensions, lazy-load below fold, keep decorative layers pointer-events:none and aria-hidden. Preserve the current hero, email scroll, Warcraft styling, and other completed work.

# Two Trees of Valinor implementation

Approved personal-dashboard presentation, October 29, 2026.

The header, page scenery, navigation, ordinary dashboard panels, Bag End controls, news, tools, and Settings use the approved silver/gold High Elven artwork. The Ravens remains a parchment scroll, with an Elven silver/gold/ivory master and emails constrained to its writing area. Settings is at the bottom of the left sidebar. Company logos remain recognizable. Existing element IDs, integrations, event handlers, data reads, and controls are retained.

Frear’s War Room, Open the Treasury, its expanded workspace, and its editor retain their previous HTML and computed presentation. The theme palette is assigned only to named affected containers, never globally to the shared dashboard. The work dashboard is unchanged.

`scripts/prepare-valinor-art.py` exports the approved PNG masters in `design/two-trees-high-elves/` to `assets/valinor/`. Exports include responsive scenery, twelve separate icons, six button states, quiet frame rails with fixed-size corners, a separate moonstone crest, and a three-part navigation divider. Source alpha is retained. Frame fills are inset beneath the physical rails, including dialog fills.

Validation:
- All 172 existing tests pass.
- Desktop and 390px phone browser previews have no horizontal page overflow.
- All three Bag End frames measure 495px high at a 1600px viewport in the fixture.
- Mobile Settings has no horizontal overflow, including its scrolling body.
- A 20-message sample inbox stays within the parchment on desktop and phone; Refresh never overlaps messages. Phone scroll rollers retain their proportions while only the paper middle stretches.
- Calendar day-navigation buttons remain within the date card. Generic link and error fallbacks use Elven compass artwork. Search fields, selectors, the Source button and weather refresh control match the theme.
- Center moonstone crests paint above the connecting rails.
- Every element under Warcraft, the Treasury entrance, workspace, and editor matches its saved pre-change computed styles for color, background, borders, border images, shadows, typography, padding, and display.
- Palantir’s old green surface, Bree’s old wooden board and posts, and the idle camera’s Hobbit image are replaced.
- The private build allowlists browser assets and excludes QA, original design PNGs, server code and credentials.

The live station feed, current-month budget behavior, private access protection, encrypted secrets, and production Plaid setup are unaffected.

# Dashboard layout — October 16, 2026

## Final arrangement

- Calendar above AI Tools in one left-hand stack, beside the Ravens.
- Bag End across the next row.
- Quartermaster beside Quick Access.
- News from Bree beside Weather.
- Tools & Systems, Warcraft, Treasury, and Words of Wisdom on individual full-width rows.

Below 1200 CSS pixels, sections follow that same DOM/keyboard reading order in one column. Calendar and AI use a real flex stack so a tall email scroll cannot distribute empty space between them. The sidebar's section links follow the new page order.

`css/dashboard-layout.css` owns the named layout map. Obsolete forced row declarations were removed from the earlier personal, budget, and art styles. Quick Access reuses the approved Dwarven nine-slice border and fixed gem; Tools & Systems reuses the Elven frame and supplied book icon. The header Palantir now uses exactly the AI Tools orb asset. Original artwork is unchanged.

## Validation

- All 105 existing tests pass. JavaScript entry-point syntax and whitespace checks pass; no JavaScript or backend files changed.
- All 156 existing IDs and 27 static link destinations are retained. Local asset references resolve. The hero/header changes only at the requested Palantir image.
- Browser geometry and rendered screenshots inspected at approximately 390, 768, 1440, and 1920 pixels: no horizontal page overflow, correct paired/stacked positions, a consistent Calendar/AI gap, readable tool and quick-link tiles, and clear frame corners. Settings, private-data masking, Treasury disclosure, device controls, mail and Warcraft behavior are preserved.
- The ignored local fixture exercises the existing controllers with synthetic appointments, long email subjects, Nest readings and budget data. The actual entry point was also inspected with real public feeds, weather and link tiles. No browser console errors were found in the preview.

Private account authorizations were not restarted for this presentation change. Private preview screenshots contain synthetic data; screenshots and fixture files are not committed.

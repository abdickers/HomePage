# Continuous sidebar — approved for publishing

This revision reproduces the POC's continuous cabinet. The actual browser result was shown beside the POC, and the user approved publishing it on November 25, 2026.

Open the [side-by-side local review](http://127.0.0.1:4180/qa/steampunk-sidebar-review/review.html). The left column is the approved POC's full sidebar crop. The right column is the real dashboard rendered in a 1440 × 2654 browser frame, cropped horizontally to its 210px sidebar. The review's motion button can pause the illustrated gears at their original position for comparison.

## Source and layout

`scripts/steampunk-sidebar-art.mjs` exports exact decorative regions from the existing 819 × 1920 approved POC. It retains the large clock's hands and face, long pipes, hanging gear train, lamp, vertical frame and carved base. Branding is an image with accessible HTML text; navigation, Personal/Work and Settings are live HTML controls. No functional controls or data cards are baked into the art.

The sidebar's reference width is 152px. Branding occupies source y0–326; the live-control region occupies y326–742; the cabinet uses y742–1920. CSS scales the same geometry proportionally. At a 210px width, the actual cabinet begins at y1025.05 and is 1627.5px tall, matching the source's scale. The long cabinet scrolls independently at normal desktop window heights instead of shrinking to fit beneath the menu. Mobile retains the compact header and hides the long cabinet.

Two circular sprites use the original POC's illustrated wheel pixels. They rotate in opposite directions beneath a fixed foreground crop of the clock bezel. Existing reduced-motion, page-visibility and offscreen pausing behavior applies.

Run `node scripts/prepare-steampunk-theme.mjs` to reproduce the assets. `assets/themes/steampunk/manifest.json` records the POC hash, crop coordinates, exported hashes and layout in `pocSidebar`. Original source artwork and the earlier candidate remain intact.

## Validation performed

- All 203 existing tests pass; all 279 referenced theme assets exist and have valid formats.
- The actual desktop render was compared beside the POC at the same 210px width and full height.
- Settings opens normally, the sidebar scrolls in a 1440 × 950 window, and illustrated wheel transforms change while motion runs.
- All seven theme menus synchronize and restore their own sidebar behavior.
- Dedicated 390 × 844 and 320 × 720 browser checks showed no horizontal overflow; the compact mobile fallback hides the tall cabinet.

The approval includes the tall, independently scrollable sidebar shown in the actual browser review. Release checks and deployment verification follow the repository's normal publishing workflow.

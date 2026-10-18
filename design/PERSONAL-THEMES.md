# Personal theme refresh — October 18, 2026

Implementation and visual QA completed in `website-refresh`. Releases use the
existing protected Worker workflow in `PRIVATE-HOSTING.md`; the deployed source
commit is recorded in the protected `/HomePage/release.json`.

## Presentation

- One supplied oak-and-ivy frame now decorates the personal header, ordinary
  panels, and the three individual Bag End control groups. No old oak frame
  or old home-control frame remains in the page DOM.
- The header landscape, wizard menu, Search, provider/scope selector and Ask AI
  remain. The image has lighter overlays so more of the landscape is visible.
- The new document divider has proportional 28px ornaments and a 12.75px
  repeating plain shaft. The gutter is reserved beside the navigation, and the
  divider is hidden on phones.
- Treasury uses the supplied vault and ledger icons, proportional iron/gold
  button skins and dark stone cards. Its existing controllers are unchanged.
- Settings and its link editor use slate and silver. Settings uses slices from
  the supplied Gondor frame, with a proportional White Tree crest.
- Warcraft source, character art, schedules and theme were preserved. No files
  in the separate work dashboard were changed.
- The old Quick Access card beside the Quartermaster was removed. Its saved
  links remain available to the header and link editor. Quartermaster currently
  shares that row with the new Google Keep companion panel.

## Header links

Settings → Preferences → Quick links shows every known link, its destination,
an accessible switch, and Move up/Move down buttons. Save preferences applies
the draft immediately; Cancel, Escape and close discard the draft. The existing
link editor continues saving add/edit/delete operations individually, as stated
in the UI. It now supports icon choice and validated dashboard section links.

Preferences live in the existing personal browser-local `sage_command_v9`
record under `settings.quickLinks` (version 1). They participate in backup,
restore and existing cross-tab updates. They do not claim account/device sync.
Removed IDs and duplicate IDs are discarded. New Quick links default enabled;
other new links default disabled. Existing all-disabled choices are preserved.

All customizable link artwork comes from the bundled registry. Unknown icons
use a local neutral symbol; image load failures expose the existing fallback.
User-entered destinations are not sent to a favicon service. Link labels are
escaped; external tabs retain `noopener noreferrer`; supported internal links
stay in the dashboard.

When more than ten header links are enabled, a native, keyboard-accessible More
menu keeps the strip compact. The default ten links form two balanced rows of
five on desktop. Escape closes the overflow menu and restores its trigger.

## Assets and build

`scripts/prepare-personal-art.py` preserves all seven supplied PNG masters in
`assets/personal-theme/originals`, and makes lossless WebP corners/rails, smaller
transparent icons, and an optimized room backdrop. `manifest.json` records the
native dimensions, alpha bounds and slice coordinates. Only quiet edges repeat;
the door, mushrooms, corner carvings and crest keep their proportions.

The private build now includes new allowlisted browser files before commit.
Originals, QA, backend code and credentials remain outside its allowlist.

## Actual verification

- 145 Node tests pass, including new migration, visibility/order,
  all-disabled, backup, removed-ID, destination validation, icon and Keep tests.
- JavaScript syntax checks, `git diff --check`, and the private build pass.
- Browser checks at 375×900, 768×1024, 1440×1000 and 1920×1080 found no
  horizontal page overflow. The updated unified frame and removed card were
  checked again on phone and desktop.
- A 720×500 viewport passed reflow and Settings scrolling checks. Native 200%
  browser zoom was unavailable in the preview browser; this narrower viewport
  is a reflow check, not a claim that native zoom was verified.
- Header order and visibility updated on Save and survived reload. Cancel
  discarded unsaved changes; all-disabled hid the strip after reload. Keyboard
  tooltip visibility, switch operation, arrow/Home/End tab navigation, Escape,
  focus restoration and explicit Tab wrapping in Settings were checked.
- The real link editor rejected `javascript:` and accepted a supported internal
  destination with a neutral icon. An HTML-looking label remained literal text.
  The temporary test link was removed afterward.
- The existing local Treasury fixture verified detail views, Manage Treasury,
  Add bill → Cancel, amount masking, refresh and phone scrolling. It reported
  **2 reads / 0 writes**. No live account or payment operation was performed.

Local preview had no authenticated Google/Nest backend session. Provider sign-in,
camera playback and live financial data were not exercised. Their existing
source controllers and tests were retained.

## Google Keep request

The user chose a manually maintained Keep panel after the personal-account API
limitation was explained. The panel has an account-scoped Open Keep button and
saved note links, sorted by their most recent dashboard save/open timestamp.
It supports add, edit, remove and Undo, validates individual HTTPS Keep note
URLs, and renders titles as text. New notes are created in Google Keep itself.
The panel does not claim to fetch note text or Google's modification dates.

Links live in the existing browser-local record under `keepLinks`. Reload,
cross-tab updates and backup/restore preserve them. Old backups without this
new field do not erase existing Keep links. The 375px form and 768px layout were
checked for overflow. Browser tests verified validation, a literal HTML-looking
title, reload persistence, edit, remove and Undo; temporary test links were
removed afterward. Open Keep points to the selected personal Google account.

Google's supported Keep API documents enterprise administration and domain-wide
delegation, rather than a supported personal-Gmail integration for this site.
Plugin discovery found no Keep connector. No additional Google scopes or backend
permissions were requested. Official reference:
https://developers.google.com/workspace/keep/api/guides

## Main changed files

- `index.html`: section boundaries, shared oak decorations, header shortcuts,
  Settings controls and Keep panel.
- `css/personal-theme.css`, `css/dashboard-layout.css`: scoped themes and layout.
- `js/app.js`, `js/core.js`, `js/settings-presentation.js`: persistence and UI
  wiring, safe destinations, backup compatibility and Settings focus loop.
- `js/quick-links.js`, `js/quick-links-ui.js`: icon registry, saved visibility,
  ordering and header rendering.
- `js/keep-notes-data.js`, `js/keep-notes.js`: manual Keep link validation,
  recency, rendering, editing and Undo.
- `assets/personal-theme/`, `assets/service-icons/`,
  `scripts/prepare-personal-art.py`: original art, derivatives and bundled icons.
- `scripts/build-private-site.mjs`, `tests/quick-links.test.js`,
  `tests/keep-notes.test.js`, `README.md`: build support, validation and usage.

## Final visual refinement

The user's final review request was followed by a visual and DOM geometry pass
over the header, Calendar/AI stack, Ravens, home controls, provisions/Keep,
News, Tools, Warcraft, Treasury entrance and footer. Refinements included:

- Removed the old silver-gray search field/button borders. The bar now uses
  warm oak/brass styling with moss fields; every search control measures 48px.
- Standardized ordinary section heading icon sizes and spacing, and kept the
  Calendar refresh action aligned beside its title on larger screens.
- Grouped retailer actions into aligned rows. Walmart and Amazon cards have
  matching heights and matching action baselines.
- Aligned the Keep and Quartermaster panel edges on desktop. Completely empty
  receipt columns are hidden while their loading/sign-in/status text remains.
- Condensed desktop Settings link rows and kept movement button labels on one
  line; phone controls retain their stacked layout.
- Verified header overflow links at 375px, their accessible names, and Escape
  focus restoration. The preview's original ten enabled links were restored.
- Checked dashboard search against Google Keep, then restored the empty Web
  search state. Checked 375, 768, 1440, 1920 and 720px widths after refinements:
  no horizontal page overflow and no heading/control-group width overflow.

Final screenshots and layout measurements are local QA outputs under
`qa/polish-final-*.png` and `qa/polish-final-layout.json`.

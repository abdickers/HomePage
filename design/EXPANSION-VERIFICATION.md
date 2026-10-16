# Middle-earth expansion implementation and verification

Prepared on `codex/middle-earth-expansion`, based on main `d142049` (including
the latest public news and Warcraft snapshots). The user has now authorized publishing the checked visual expansion to GitHub Pages.
The private Worker is outside this presentation-only deployment.

## Scope

- `index.html` adds one Treasury disclosure around the original budget tree,
  decorative Bag End frame and climate readout, and a Bree article backdrop.
  The hero, Ravens section and Warcraft section are byte-for-byte identical to
  the starting revision. All 134 original IDs and 27 links remain.
- `css/realm-expansion.css` supplies the new scoped presentation. The oak frame
  has eight measured corner/rail assets. The tall ivy and hanging lantern keep
  fixed proportions; only quiet oak strips repeat. Controls stay inside the frame.
- `js/treasury-disclosure.js` and its small `js/realm-expansion.js` entry point
  implement the native button disclosure. It starts closed on every page load.
  Hidden content uses `hidden` and `inert`, and there is one live budget tree.
  Opening focuses Close Treasury; closing restores inside focus to the entrance.
  A 280ms crossfade is skipped for reduced motion, with a matching CSS override.
- `js/thermostat-presentation.js` presents the existing confirmed gateway fields.
  `js/nest.js` calls it after confirmed reads and when freshness or command state
  changes. `js/app.js` changes only the Nest module cache version.
- `js/budget.js`, mail, Google authorization, all provider endpoints and request
  shapes, camera streaming code, Worker/KV/D1 configuration, and synchronization
  modules are unchanged. No new smart-home device controls were added.

## Artwork and delivery

All seven source PNGs in `assets/expansion/originals/` match the supplied SHA-256
manifest. The pack's instructions remain in `design/expansion-pack/`.

| Original | Native dimensions |
|---|---|
| Closed mine entrance | 1536 × 1024 RGB |
| Lonely Mountain treasury | 1916 × 821 RGB |
| Bree noticeboard | 1672 × 941 RGB |
| Oak and ivy frame | 1672 × 941 RGBA |
| Six-icon home atlas | 1536 × 1024 RGBA |
| Heating fireplace | 1393 × 1129 RGBA |
| Cooling open window | 1536 × 1024 RGBA |

`scripts/prepare-expansion-assets.py` generates 35 WebP derivatives, including the later ring update
and continuous noticeboard posts. It verifies source checksums and decoded alpha against each
prepared image. No source is edited, upscaled, or filtered by dark pixel color.
Coordinates and delivery dimensions are recorded in `derivative-manifest.json`.

Atlas bounds were reviewed individually, then the six resulting icons were
inspected on dark green. Camera gate and climate heading use small responsive
64/128px versions. The atlas's closed window is a static climate heading icon;
COOL mode uses only the dedicated open-window artwork. Other atlas crops are
retained for future supported functionality, without inventing light/lock controls.

The Bree scene's top retains the pony sign and lantern at their source aspect
ratio. A quiet central wood crop and separate lower rail accommodate arbitrarily
long live headlines. All widths now place the notices on the board, as requested in the follow-up.
Quiet measured post strips continue down the flexible board body; a separate
lower rail closes the scene. Tablet/mobile use one readable column of notices.
All article text, links, source tabs and timestamps remain HTML. The treasury
scene is used once behind opaque financial surfaces, with the existing Dwarven
outer frame. The closed entrance now has its own fixed-corner Dwarven border.
Weather reuses the Elven frame, and the Quartermaster reuses the oak/ivy frame
with an independent, wrapping header. These are native assets, not 4K masters; full-width treasury imagery
does not provide true 2x density on every large screen and is deliberately subdued.

## Thermostat state behavior

The existing gateway exposes `mode`, `hvac`, `online` and a response `updatedAt`.
Google documents mode separately from [HVAC activity](https://developers.google.com/nest/device-access/traits/device/thermostat-hvac),
including idle activity `OFF`; see also [ThermostatMode](https://developers.google.com/nest/device-access/traits/device/thermostat-mode).
An unsaved mode selection is never input to illustration selection.

- HEAT: fireplace, with separate Heating now, Idle or Activity unavailable text.
- COOL: dedicated open window, with separate Cooling now, Idle or unavailable text.
- AUTO/HEATCOOL: activity chooses fireplace/window; idle or unavailable uses a neutral glyph.
- OFF and unknown/offline devices: neutral glyph; conflicting activity is labeled.
- A failed read or a check older than three minutes marks retained readings as
  stale, with Last known mode, Last reported activity and the last check timestamp.
  The timestamp describes a gateway check, not an invented sensor event time.
- Pending commands keep prior confirmed artwork. Rejected commands restore the
  confirmed dropdown and show failure text. Accepted changes wait for a subsequent
  successful device read; failure to confirm leaves an explicit waiting/stale view.
- Ambient temperature, target fields, humidity, device selection and camera
  controls retain their existing behavior. No extra flame animation or activity
  glow is used merely because HEAT is selected.

## Verification actually performed

- All **105 Node tests passed**, including the original 87 and 18 additional
  mode/activity, freshness, conflict, pending/failure and disclosure checks.
- Syntax checks passed for app, Nest, personal mail and the three new modules.
  Repository whitespace checks, original ID/link preservation and local asset
  references passed. This is buildless; no package install/build is required.
- Browser inspection at **1440 × 1000**, **768 × 1000**, and **390 × 844**:
  document widths were 1425, 753 and 375 respectively (vertical scrollbar included).
  No horizontal overflow, overlapping ornament controls, or clipped notice text.
  Both open and closed treasury states and Bag End/news layouts were inspected.
- The actual Nest frontend ran against an isolated, in-memory simulated gateway
  for HEAT/COOL idle and active, AUTO heating/cooling/idle/unavailable, OFF, unknown,
  offline, stale data, activity conflict and failed refresh. Draft selections,
  rejected commands, delayed commands and successful confirmation were exercised
  through the real controls. Real thermostat settings were not changed.
- Native Enter and Space opened the treasury; Close Treasury restored focus.
  Closed content had zero visible tab stops and retained `inert`. The original
  budget module's Show/Hide amounts controls worked with synthetic budget data.
  The reduced-motion branch was unit tested; the browser's OS motion preference
  was not changed.
- The regular homepage loaded real Fox, Wowhead and Hacker News feeds, with
  source switching and source links verified. Nest's disconnected state remained
  neutral. Artwork loaded from local asset URLs without missing files.

Screenshots and the labeled example-data/state fixture are ignored under `qa/`.
The fixture's simulated Nest credential stays in a private in-memory store, separate
from other local preview tabs. It does not contact Google, Plaid or Nest. Private
signed-in data and real camera/thermostat behavior need verification on the authorized
live origin after a separately approved deployment. Existing origin restrictions
are preserved; private connections are intentionally unavailable on localhost.

## Follow-up artwork

The updated footer ring, supplied as onering_Image.png in Command Center, is
retained unchanged as assets/expansion/originals/one-ring-footer.png. Its native
size is 1536 × 1024 RGBA, with 480px and 256px alpha-preserving WebP delivery
variants. The full ring, inscriptions and warm translucent halo are retained;
no dark pixels were removed. Provenance and checksum are recorded separately
in design/expansion-pack/footer-ring-manifest.json, preserving the original
seven-file supplied manifest.

Follow-up checks: all 105 tests and application/Python syntax checks passed again.
The 390px, 768px and 1440px layouts were inspected with real public headline
content, with no horizontal overflow or clipped article text. The supplied ring
loaded with its halo on the actual dark footer. Elven weather, oak provisions and
Dwarven entrance frames left controls clear. Enter opened the treasury, Close
restored entrance focus, and closed content had zero visible tab stops and was inert.
All 134 original IDs and 27 links were preserved; header, mail and Warcraft markup
remains unchanged. No Google, Plaid, Nest or Cloudflare configuration was modified.

## Chrome Hobbit-border color compatibility repair

The owner reported white Hobbit corners and side posts in Chrome. The original
artwork, served assets and application CSS contain their correct brown/green
colors, and the report could not be reproduced in the available Codex browser.
Chrome itself is not connected for direct profile verification.

Bag End and Quartermaster now use eight lossless PNG delivery crops with new
color filenames. Each decoded RGBA pixel is checked against its original crop.
The source PNG and old WebP derivatives remain intact. Only the screen-reader-
hidden, noninteractive oak-frame layer declares color-scheme: only light, using
Chrome’s documented per-element opt-out from automatic darkening. This does not
change the dark panel, controls, privacy toggles or user forced-color preferences.
Reference: https://developer.chrome.com/blog/auto-dark-theme#per_element_opt-out

The generator now records 43 derivatives including the eight PNG alternatives.
All 105 application tests pass. Final confirmation of the original Chrome-profile
washout requires the owner to reload the deployed correction in that browser.

The PNG repair was visually inspected at 390px, 768px and 1440px, including
both full-width Bag End and Quartermaster. No horizontal overflow was observed.
The decorative layer computes to light only while receipt controls retain their
normal scheme; hidden artwork remains noninteractive and screen-reader-hidden.

# Personal dashboard review · 2026-10-18

Quick Access and Tools & Systems reuse the measured Gondor frame slices, with interior surfaces ending inside their rails. All Tools tiles and Add Link share a silver/charcoal palette. The management group links to the personal Cloudflare account, abdickers/HomePage, Plaid Dashboard and Google Cloud Console. Google Cloud receives the personal account hint; GitHub and Plaid retain the browser's existing sign-in. Management links participate in dashboard search. War Room Refresh uses the existing Alliance blue control palette.

Bag End uses the supplied room backdrop beneath live controls. The original room and transparent control-frame PNGs are preserved in `assets/bag-end/room/originals/`; the design reference is not shipped. `scripts/prepare-bag-end-room.py` reproduces delivery art and eight lossless frame slices, verifying exact alpha. The asymmetric top-left slice preserves the long ivy. Fixed corners and flexible quiet rails frame each control group separately. The room scales proportionally at the top with a walnut continuation and separate sill; its transparent outer margins do not receive a background. Three-column desktop frames stretch equally to the tallest content. Two-column and stacked layouts remain content-driven. Nest/weather handlers, supported modes, authentication, video lifecycle, selector position and contain sizing are unchanged.

## Central Bank CSV

Open **Manage Treasury → Spending → Import Central Bank CSV**. Choose a unique account nickname and a bank CSV, review the column mapping and preview, correct transaction types, check the review box, then Import. The default format is `Date,Description,Amount,Balance`. Dates accept US or ISO calendar dates; amounts are signed USD with exact integer cents. Negative means money out. Balance is ignored and does not create an account balance. Files remain in browser memory until the explicit import; raw files are not stored. Limit: 500 rows / 2 MB per file, 10,000 ledger transactions.

Transfers/card payments and income are excluded from spending. Unknown credits and ATM withdrawals start in Needs review. CSV entries are labeled separately from Plaid Sandbox. Matching date/description/amount occurrence counts under the same nickname prevent repeated-export duplicates while preserving repeated rows within a file. Without bank transaction IDs, identical entries across separate partial exports are ambiguous; inspect those exports. Renaming the nickname creates a separate source.

Real Plaid production history takes priority: CSV history stays visible but all CSV totals pause to avoid cross-provider double counting. This is deliberately conservative across the whole ledger, including older CSV-only periods. No fuzzy automatic merge occurs. Recent import batches offer Undo, which removes only that batch's new entries and their corrections. Prior entries, other owners and other providers remain intact.

CSV writes use the existing authenticated owner routes, origin checks and owner lock. Complete requests are validated before an atomic three-statement D1 batch. The set insert uses bound JSON and remains within D1's query/parameter limits. No new database schema, credentials or Cloudflare bindings are required.

## Verification

- 137 Node tests: parser bounds/quoted fields, exact cents, owner isolation, authentication/origin rejection, atomic rollback, 500-row import, duplicate handling, annotations, Undo, Plaid priority and daily database allowance handling, plus existing integrations.
- Local browser checks used the user's explicitly false CSV in an isolated in-memory SQLite database. First import added four; second added zero/skipped four; Undo removed the batch. Default past-seven-day spending was $42.15; transfers/payroll were excluded and cash stayed unavailable. Privacy masking remained active.
- Bag End screenshots reviewed at 375, 768, 1100, 1440 and 1920 CSS pixels. Three frames measured equal heights on both three-column desktop widths; no horizontal page overflow. Mobile retained all three individual borders. Focus rings remained visible and interactive targets measured at least 44px.
- Synthetic landscape → portrait camera switching continued playback without another Watch click, with 720×1280 video contained in the 16:9 viewport. No physical thermostat commands were sent.
- First and second visual passes covered dashboard ordering, controls, Quick Access, Tools, Ravens, Bree and both War Room modes. Search found Cloudflare. New asset alpha is preserved; no dark-pixel removal or full-frame bitmap stretching.
- The in-app browser does not provide native page zoom. Narrow-width reflow was checked; an exact 200% browser-zoom check remains a manual follow-up.

Worker best-practices review used current Workers types 5.20261016.1 and [D1 limits](https://developers.cloudflare.com/d1/platform/limits/). Source artwork, QA fixtures, screenshots and private backend sources remain excluded from the static delivery bundle.

## Live release verification

PR #26 was merged and deployed. The authenticated live Bag End view showed three equal 539.98px frames at 1440px, working remembered Nest status and camera choices. Anonymous checks passed for the private page, assets and API routes, including both CSV endpoints; the signed-webhook exception retained its rejection checks. KV, D1, Access and secret bindings were preserved.

The final live Treasury check exposed an exhausted Cloudflare D1 daily free allowance, confirmed by sanitized runtime diagnostics. Table names and schema were checked without reading ledger contents. No schema or financial-data changes were made. A follow-up returns an explicit 503/Retry-After until 00:00 UTC and pauses the browser's automatic Treasury polling until then, preserving manual Refresh for recovery after a plan change. Temporary diagnostics were removed. Live CSV import could not be exercised while this provider allowance was exhausted; its import/reimport/Undo flow was verified only against the isolated local database. [Cloudflare documents the daily reset and upgrade options](https://developers.cloudflare.com/d1/platform/pricing/). Native 200% zoom and live CSV verification after quota recovery remain follow-ups.

# Treasury summary and workspace — review branch

## Branch and rollback

- Feature branch: `codex/treasury-summary-workspace`.
- Baseline tag: `treasury-before-summary-20261017`.
- Baseline commit: `edf310698e974d6ec736f792050591b1963a2214` (the working homepage plus its latest scheduled public feeds).
- This branch is for implementation and preview. It does not change the deployed frontend or Worker until separately released.

Before merge, returning to `main` restores the existing UI while retaining this work on its branch. After a future squash merge, revert that feature merge commit through the normal PR workflow and republish the frontend. Reverting the feature commit preserves unrelated later work and feed updates; do not reset `main` to the old tag. The tag is an exact comparison/recovery point.

There is no database migration, record conversion, credential change, or new provider permission. The snapshot extension is opt-in and supports the old client, so a frontend rollback does not require relinking banks or mail. If the Worker itself is rolled back later, use its previous deployed version while preserving bindings and secrets.

## Behavior

Opening the existing mine door reveals a compact summary: current available cash, spending in the selected period, confirmed bills in the upcoming week, review count, five recent production entries, and three upcoming bills. Date filters default to seven calendar dates including today in America/Chicago; 30 days, this month, and custom past dates are also supported. Current cash and future bills are explicitly separate from historical activity dates. Monthly limits continue to compare with month-to-date spending.

Summary cards and View all links open a read-only native dialog. Manage Treasury enables the existing bills, spending, review and planning controls there. The original editors open above that workspace; save refreshes the summary and returns focus to the matching row. Bank/mail connection controls remain in Settings. Read-only modes render no mutation buttons, with an additional controller guard against mutation actions outside management or Settings.

The Dwarven scene, door, financial privacy toggle and financial rules remain. On phones, ledger tables become labeled cards while retaining their real table headings for assistive technology. Only the modal body scrolls; navigation, privacy and Close remain visible. Escape closes the top dialog, and workspace closure restores the exact summary trigger. Sign-out/session loss closes both dialogs and clears their financial content, including editor fields.

## Read-only snapshot extension

`activityStart` and `activityEnd` opt into historical filtering on the existing authenticated `/budget/snapshot`. Both must be single, valid calendar dates, ordered and ending today or earlier. Aggregation and pending replacement occur before 50-row UI pagination. The response adds `activity`; legacy month-to-date summaries, cash, projections, review scope, auth, writes and sync behavior are unchanged. Review transactions remain accessible even outside the selected activity window.

Sandbox entries, removed entries, replaced pending records, transfers, person-to-person payments and non-USD amounts are excluded from real USD purchase totals as appropriate. Refunds reduce spending; pending amounts are separate. The existing processing limit is retained, and incomplete period totals are withheld in the main summary. The UI never estimates a period total from only the first loaded page. An older gateway without `activity` gives an explicit unavailable message instead of a fabricated total.

When this branch is approved for release, deploy the additive gateway read support before publishing the frontend, using the existing repository deployment workflow and preserving Worker secrets/KV/D1 bindings. No deployment is performed as part of this preview.

## Verification

- All 118 project tests pass, including Chicago/DST date presets, invalid/duplicate/future ranges, full-period aggregation beyond 50 entries, pending/refund/sandbox exclusions, escaping/masking, and unchanged planning/storage results.
- Browser preview uses the real budget controller and pure server summary functions with synthetic records and an injected local fetcher. It never connects to a real bank or mailbox or writes real financial records.
- Checked presets/custom dates, reversed-date rejection, rapid out-of-order filter responses, failed-refresh preservation/recovery, read-only pagination and exact focus restoration.
- Saved a synthetic bill through the original editor and verified the refreshed value, summary, open workspace and row focus. Shared amount privacy masks both main and popup views. Session expiry while editing empties all private views.
- Summary and management dialog inspected at approximately 390, 768, 1440 and 1920px. No horizontal page overflow; Close remains visible, the scroll body stays inside the dialog, and phone edit controls remain within labeled rows. Existing reduced-motion disclosure tests still pass; the new workspace adds no animation.

Local ignored preview: `http://127.0.0.1:4180/qa/treasury-summary.html#budgetPanel`. Screenshots and synthetic fixture files remain under ignored `qa/`. These are not evidence of a live financial connection. Private production consent and the new gateway response have not been tested against the live account in this branch-only task.

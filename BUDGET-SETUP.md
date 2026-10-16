# The Steward: private budget dashboard

The existing buildless GitHub Pages app calls the existing `sage-cabin-nest` Worker. Financial records are in the private `sage-home-budget` D1 database, scoped to the SHA-256 identifier of the verified owner. Google and Plaid connection tokens use AES-GCM encryption in the existing KV namespace. Neither provider tokens nor mailbox bodies are sent to the public frontend or committed to Git.

## Deployment

Use Node 24 for tests (`node:sqlite` exercises the production SQL). Wrangler 4 is required for deployment. Keep its login in the OS keyring. The required scopes are `account:read`, `user:read`, `workers_scripts:write`, and `d1:write`; no KV management/write OAuth scope is needed to deploy the existing binding.

```sh
npm test
node --check js/budget.js
wrangler d1 migrations apply sage-home-budget --remote --config nest-service/wrangler.jsonc
wrangler deploy --config nest-service/wrangler.jsonc --keep-vars
```

Deploy the Worker before publishing the frontend through the existing GitHub Pages workflow. Inspect current Worker bindings first. Preserve `GOOGLE_CLIENT_SECRET`, `TOKEN_ENCRYPTION_KEY`, `GOOGLE_CLIENT_ID`, `OWNER_EMAIL`, the exact origin `https://abdickers.github.io`, and the existing `NEST_KV` namespace. Do not rotate the encryption key without migrating existing encrypted records. D1's binding is `BUDGET_DB`. Its migration adds only budget tables.

Private initial bill values belong in D1, entered through the authenticated editor or a private administrative import. Public default records intentionally have unknown amounts and schedules. Deleting the entire budget resets those private values; a later new budget starts with unknown defaults.

## Plaid setup: Sandbox first

1. Open your Plaid dashboard, configure the app for **Transactions**, and obtain the client ID and **Sandbox** secret. The app verifies Balance and Transactions institution coverage; it does not request bank transfer or payment products.
2. In Cloudflare → Workers & Pages → `sage-cabin-nest` → Settings → Variables and Secrets, add `PLAID_CLIENT_ID` and `PLAID_SECRET`, both as **Secret** values. Enter them directly there. Keep existing secrets. Leave the plain variable `PLAID_ENV` as `sandbox`.
3. In Plaid's allowed redirect URIs, add exactly `https://abdickers.github.io/HomePage/` (including capital H/P and trailing slash). The Link token specifies the Worker webhook URL `https://sage-cabin-nest.nest-service.workers.dev/budget/plaid/webhook`.
4. Open the homepage using the primary personal Google connection. Under The Steward → Connections & plans, check institution coverage, then connect the **sandbox test bank** through Plaid Link. Follow Plaid's [Sandbox testing instructions](https://plaid.com/docs/sandbox/). Test transactions remain visibly labeled and excluded from real balance and spending summaries.
5. Complete an end-to-end Sandbox Link exchange, sync, live balance request, and reconnect/disconnect check before switching to real-bank credentials. Node tests simulate provider responses; they do not establish that your Plaid account has production access.

### Real Central Bank connection and costs

The target is [Central Bank of Boone County](https://www.centralbank.net/boone-county/), part of Central Bank at `centralbank.net`. Plaid's public institution explorer lists a Central Bank (MO) personal connection with Balance and Transactions; that listing alone is not treated as live compatibility proof. In **production**, the server calls `/institutions/search` and requires a personal Central Bank institution, the exact bank domain (or a subdomain), and both products. After Link, it independently checks the actual Item's institution. A different/unsupported institution is rejected and the new Item removed. Do not choose a business institution or an unrelated Central Bank.

New Plaid accounts may qualify for a [Trial plan](https://plaid.com/docs/account/billing/) with up to ten production Items, subject to the account's eligibility and product setup. Sandbox is free. Paid pricing is account/contract specific; Transactions generally uses subscription billing and live Balance calls may incur per-request charges. Review the actual plan and production application in Plaid before accepting terms or upgrading. This app never upgrades your plan. Production/Trial access, Link customization, and any Plaid review must be completed in your account.

Once access and terms are settled, replace only `PLAID_SECRET` with the production secret, set `PLAID_ENV=production` in the deployment config and Cloudflare, and redeploy. Sandbox and production Items/tokens are separate. Delete Sandbox imports from the app before live linking. Only a successful API institution check plus your actual Link connection and sync verifies real-bank access. The app requests 365 days; available history depends on the institution.

## Read-only Gmail discovery

The homepage's existing primary Google authorization already requests `gmail.readonly`. A ChatGPT connector is not used as deployed-app authorization. Choose **Scan primary Gmail** to enable budget discovery for the configured owner. Choose **Connect sage4997@gmail.com** for the separate legacy mailbox. The latter opens Google consent for only OpenID/email and `gmail.readonly`, verifies the selected address and actual mailbox, and stores its separate offline grant encrypted on the Worker.

The Google client must allow `https://sage-cabin-nest.nest-service.workers.dev/auth/callback`. Returns go to `/HomePage/#budgetPanel`. Complete consent yourself with the intended mailbox. If the Google app is in Testing, add that account as a test user; Google may expire testing refresh tokens. Production restrictions or verification for Gmail scopes are controlled by Google. Primary Gmail/Calendar and Nest keep their existing grants and remembered sessions.

Discovery starts with a frozen 366-day window, paginates 15 relevant messages per batch, then scans new messages with a two-day overlap. The UI can continue up to 20 batches; the ten-minute Cron advances one bounded queued job at a time. Sync failures retain the last successful data and checkpoints with an error/backoff indicator. The parser stores structured fields, short labeled evidence spans, and source permalinks; no attachments or complete email bodies are retained. It only calls Gmail read endpoints and never sends, deletes, archives, or marks messages read.

## Budget behavior and limits

- Bank entries are the spending ledger. Receipts enrich or match them and never add a second expense. Pending-to-posted replacement, refunds, transfers, credit-card payments, explicit P2P, duplicate order receipts, and unique split shipments are handled separately. Ambiguous matches and generic PayPal entries require review.
- Email extraction is conservative and deterministic. Missing or conflicting totals/dates, price changes, and cancellation notices require review. A cancellation is not automatically assumed effective. Correct extracted fields, edit the bill, or confirm matching posted payments. Manually edited bill plans take precedence over automatic recurring-plan discovery.
- Variable bills use known invoice dates and amounts, not repeated forecasts. Annual charges retain the actual renewal and a separate monthly budgeting equivalent. The user's mortgage deadline and contractual statement date are separate fields.
- Projections use included USD depository accounts, a 30-day Chicago date window, confirmed upcoming bills, and only entered paydays. Available cash is preferred to current cash; a uniquely matched pending payment already reserved in available cash is not subtracted again. Paid/reflected bills are not deducted. Missing, disconnected, or older-than-24-hour cash balances withhold the projection. Incomplete coverage, unconfirmed/overdue obligations, and unknown income remain visible; no figure is called safe to spend.
- Amounts are hidden on every page load, including in work contexts. Financial snapshots live only in page memory and clear on sign-out. The existing revocable, remembered opaque app session remains in browser storage; private provider tokens do not. Plaid's short-lived Link token uses session storage only to resume OAuth and is cleared on completion/exit.
- Snapshot processing is capped at 10,000 records per kind and 50 entries per transaction/review page. The UI labels incomplete coverage and suppresses projections if that cap is reached. Foreign currency amounts are not converted or silently counted as USD.
- Disconnect stops that source's budget sync and removes its dedicated encrypted credential. Deleting a source purges imported records and corrections; manual plans remain. Deleting the entire budget revokes Plaid Items and removes private budget records and the legacy Gmail grant. Primary Gmail, Calendar, Nest, and actual bank/email records are unaffected. D1 provider backups/Time Travel follow Cloudflare's retention; deletion from the live app does not erase provider backup history immediately.

## Verification

`npm test` covers existing homepage behavior plus integer-cent calculations, date boundaries, deduplication, pending replacements, refunds, projections, merchant aliases, conservative email parsing, institution verification, signed/tampered/stale webhooks, actual SQLite owner isolation, atomic pagination/promotion, cursor restart/backoff, source purge, manual corrections, and financial route authentication. Local workerd/D1 checks additionally verify runtime compatibility. Desktop and phone UI checks use an explicitly labeled local fixture, never a real account balance.

Live connections still require credentials and the account owner's consent. A deployment, passing tests, or a public institution listing is not evidence of a connected bank or completed Gmail backfill.

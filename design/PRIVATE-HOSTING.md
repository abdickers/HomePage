# Private Cloudflare hosting

The private dashboard is live at **https://sage-cabin-nest.nest-service.workers.dev/HomePage/**. Cloudflare Zero Trust Free is active. GitHub Pages was disabled with the owner's explicit approval on October 17, 2026; the repository and its history are retained. This migration is tracked on `codex/cloudflare-private-hosting` and merged through the normal PR/check workflow.

## Verified release

- First verified protected release: Worker version `a8a358ac-d1a6-4127-a196-d903b5db5121`, source commit `0e2eb61f7915a592885412ef08d599a20b185fbd`. Later releases identify their exact source in the protected `/HomePage/release.json`.
- Access team: `https://noisy-moon-7c51.cloudflareaccess.com`.
- Whole-host application: `69f1d05d-3d30-473e-a49b-fcb90b525a63`, **Sage Command Center — Private**. Policy `8121eb77-b655-4dc0-8ef7-cecc88b4225d` allows only the two exact addresses below. OTP is its only enabled identity provider. Its session lasts 168 hours, with HttpOnly, binding and SameSite=Lax cookies; preflight bypass is off.
- Signed-webhook application: `4b9ba4b9-a19d-4fd9-a972-e990d673ef12`, scoped to `/budget/plaid/webhook`. The owner explicitly approved this machine-only Access exception; the Worker independently restricts it to exact-path POST and validates the existing Plaid signature.
- All 128 tests passed, including real RSA-signed Access assertions and original budget/session behavior. Wrangler dry-run, generated binding types and local workerd rejection checks passed.
- Sixteen live anonymous checks passed: page, script, image, feed and API requests redirect to the expected Access team; unsigned webhook POST is rejected with 401, and webhook GET/nested POST with 403.
- The owner completed live Access login and reconnected personal Google and Nest. A reload retained both connections; Gmail rows and Nest status loaded, the Treasury was available and amounts stayed hidden. No device command or financial edit was performed for this verification. Browser console checks found no errors.
- GitHub's Pages API returned 204 for retirement and subsequently 404 for its configuration. The repository remains public source code; website access and financial data are separate from repository visibility.

Existing Google/Plaid secrets, the token encryption key, KV namespace, D1 database and ten-minute scheduled sync were preserved. Plaid remains **Sandbox**. Before a future OAuth bank Link, add the new private dashboard URL to Plaid's allowed redirect URIs; that console change and production eligibility are not implied by this release. A pre-existing budget Gmail discovery warning was not treated as proof of a successful backfill or changed during this security migration. Work-email login is covered by the exact policy and signed-token tests; the live login verified here used the personal email.

## Architecture

The homepage and existing gateway share `https://sage-cabin-nest.nest-service.workers.dev`. The page retains `/HomePage/`, while Google retains its already registered `/auth/callback`. The existing Worker secrets, encrypted KV grants, D1 budget, Cron and financial rules remain intact. Moving to a new browser origin requires a one-time provider connection in that origin; saved grants and imported financial records are not deleted.

Cloudflare Access must protect the entire hostname, with one Allow policy listing exactly `abdickers@gmail.com` and `dickersona@76fireworks.com`. No email-domain, everyone, account-member or broad bypass rule belongs in that application. One-time PIN can authenticate either approved mailbox without registering a new Google OAuth client. Use HttpOnly cookies and SameSite=Lax so the top-level Google callback works, with a remembered 168-hour site session.

The Worker independently verifies the Access assertion using `jose`: RS256 signature, issuer, application audience, expiry, required subject/email, application-token type and the same two exact approved email addresses. Unset configuration, a missing assertion, or a failed verification denies content. An alternate hostname is rejected. The original app sessions and origin checks still authorize all Google, Nest and budget operations; Access login does not itself grant or replace Google provider consent.

The sole public machine endpoint is exact `POST /budget/plaid/webhook`, via a separate path-specific Access bypass application. Existing Plaid JWT and body-digest verification still applies. GET, nested paths, other methods and every financial read remain protected. Do not bypass `/budget/*`, `/auth/*` or the whole Worker.

`assets.run_worker_first=true` ensures every asset passes the Worker guard. Only allowlisted static resources are copied to `dist-private/HomePage/`; backend source, credentials, migrations, Git metadata, QA fixtures, docs and source-art originals are excluded. Worker responses use private/no-store caching, anti-framing, no-referrer, noindex, HTTPS and a document CSP with fresh script nonces. Plaid loads its official SDK with the matching nonce. Browser API requests retain the Access cookie only for the same origin. Settings includes site sign-out, which forgets local Google/Nest sessions without deleting provider grants. Restoring a Back/Forward cache snapshot reloads through Access.

The existing GitHub scheduled news/WoW jobs continue unchanged. The protected Worker reads only the two fixed public JSON snapshot URLs with bounded responses, forwarding no identity headers, cookies, authorization, or user query. A failed read falls back to the packaged dated snapshot and existing stale-data indicators. No CI Cloudflare credential is created.

## Release steps

1. Enable Zero Trust on the existing account; choose a free plan if onboarding requires plan selection. Account-owner interaction is required for login, any CAPTCHA, or acceptance of new service terms.
2. Configure the whole-host Access app and exact two-email Allow policy. Configure only the precise signed-webhook exception. Read back the actual team domain and AUD into `nest-service/wrangler.jsonc`.
3. Inspect deployed settings before release. Preserve all secrets, KV/D1 IDs, Sandbox/production mode, schedules and manual settings. No schema migration or credential rotation is part of this release.
4. Run `pnpm install --frozen-lockfile --ignore-scripts`, `pnpm test`, `pnpm build:private`, `pnpm exec wrangler deploy --config nest-service/wrangler.jsonc --keep-vars --dry-run`, and generate types with the same config.
5. Deploy the protected Worker, then verify anonymous HTML, JS, image and API requests are blocked or routed to Access. Verify invalid webhook signatures remain rejected without an Access redirect.
6. Owner signs in through Access and checks the dashboard, one-time provider connections, signed-in reads, controls, CSP/console and logout. Add the new exact `/HomePage/` URL to Plaid's allowed redirect URIs before an OAuth bank connection; Sandbox's non-OAuth test fallback remains unchanged.
7. Disable the old GitHub Pages publication and verify it no longer serves the dashboard. Keep the repository and its history; disabling the site does not remove source code. Public source code is separate from the private hosted application's authorization.
8. Merge through the existing PR/check workflow, retaining the branch and documenting actual deployed version/Access IDs and verification results. Future code releases use the pinned `pnpm deploy:private` workflow; feed updates do not need full redeploys.

## Recovery

Keep Access protection active during recovery. Do not roll back only to a former public Worker version or re-enable GitHub Pages. Restore a known protected release, or leave the site denied while repairing it. D1/KV data and encryption keys must remain unchanged. The previous public Treasury release is commit `6955e00d96833e4272fb56267cc224ce4a8e661f`, Worker version `aaf56fbb-b5bc-4b29-85e1-3be29c347dad`; those are comparison points, not safe public recovery targets.

# Private Cloudflare hosting

This migration is prepared on `codex/cloudflare-private-hosting`. It is not active until Cloudflare Zero Trust onboarding, Access application configuration, deployment, and retirement of GitHub Pages have been verified.

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

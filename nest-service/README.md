# Sage Cabin private Nest service

The dashboard and gateway now share https://sage-cabin-nest.nest-service.workers.dev, with the page at `/HomePage/`. Cloudflare Access and an independent signed-assertion Worker guard protect the entire hostname for the two approved owner emails. GitHub Pages is disabled. See [private hosting](../design/PRIVATE-HOSTING.md) for the actual Access IDs, verification and recovery rules. No paid stream relay or domain is required for WebRTC cameras. An RTSP-only camera requires a separate gateway and remains an explicit Google Home link here.

## Deployment

1. Use the existing personal Wrangler sign-in with account/user reads, Worker-script writes and D1 writes. KV management permission is not needed to deploy the existing binding.
2. Inspect deployed settings. Preserve `NEST_KV`, `BUDGET_DB`, all Google/Plaid secrets and the encryption key. Never replace the namespace or key during an ordinary release.
3. Keep the whole-host Access application and exact signed-webhook exception configured as documented. Match `ACCESS_TEAM_DOMAIN`, `ACCESS_AUD` and `FRONTEND_ORIGIN` to the current protected host.
4. Keep `https://sage-cabin-nest.nest-service.workers.dev/auth/callback` registered on the existing Google web OAuth client. Smart Device Management API is enabled in `homepage-497902`.
5. From the repository root, install pinned dependencies, run `pnpm test`, build with `pnpm build:private`, and dry-run Wrangler using `nest-service/wrangler.jsonc`. After the PR/check workflow, use `pnpm deploy:private`; this preserves deployed variables with `--keep-vars` and deploys assets plus the guard. Do not publish Pages or deploy `worker.mjs` directly.
6. Sign into the private site, then connect personal Nest using abdickers@gmail.com and explicitly select devices in Google's Partner Connections Manager. Verify reads and remembered sign-in without changing devices merely to test deployment.

## Security and limits

- Only the verified owner email can create a Nest connection. Provider access and refresh tokens are encrypted with AES-GCM before KV storage.
- Cookie-bound OAuth state expires after 10 minutes and identifies whether the grant is for Nest or Gmail/Calendar. Application sessions are random, hashed for lookup, and last 30 days and renew while active. Active sessions renew their expiry at most weekly. The page remembers only that revocable app session in browser storage, bound to this gateway. It never stores Google tokens there. A return link can carry an opaque application session in the fragment when Google severs the popup opener; the dashboard removes that fragment immediately.
- All device API endpoints require a session and the exact dashboard origin. Device commands are allowlisted and temperatures validated. No arbitrary Google API proxy exists.
- Camera sessions belong to the application session that created them. No microphone or browser camera permissions are requested. Nest video/audio is received only. Video closes when the dashboard is hidden and after five minutes; the user can explicitly restart it.
- Device status polls once a minute only while the dashboard is visible. There are no paid scheduled jobs. Free-plan limits stop service when exhausted; don't upgrade the account to bypass them without Adam's approval.
- Disable invocation logs; never log OAuth URLs, authorization headers, tokens, device responses, or SDP. The Worker intentionally emits no payload logs.
- “Sign out” closes the page's session. Persistent Google device permissions can be revoked in Google Home / Partner Connections Manager.

## Remembered Gmail and Calendar

`/auth/start?service=google` uses Google's standard authorization-code flow with only OpenID email identity, Gmail read-only, and Calendar events read-only. It shares the existing `/auth/callback` redirect, client secret, encryption key, and KV binding. Enable both APIs on the existing Google project. The personal OAuth app is already in Production; Testing-mode refresh tokens would expire after seven days.

The callback requires the verified owner email, the same Gmail mailbox, and both read scopes before writing `google:owner`. It does not replace the Nest `owner` record. Google sessions cannot access Nest endpoints and Nest sessions cannot access Google endpoints. `/google/read` allows only this dashboard's userinfo, own-mailbox profile/messages, and calendar-event GET requests. It rejects arbitrary hosts, other mailbox users, attachments, writes, and unrecognized query parameters. Responses are bounded and never cached. A failed Google refresh revokes that app session.

The browser revalidates its saved session on each page load. Gmail/Calendar use the gateway for every Google read; raw Google credentials never reach the browser. Same-origin API requests include the separate Cloudflare Access cookie. Signing out Google clears both views and revokes that browser's shared Google session. Nest sign-out remains separate. Site sign-out ends Cloudflare Access and forgets local Google/Nest app sessions without deleting encrypted provider grants. Existing secrets and the KV namespace must be preserved during deployment; do not rotate the encryption key as part of these changes.

## Validation

`npm test` at repository root includes unauthenticated/session/origin rejection, OAuth state rejection, setpoint bounds and device state, safe device projection, and bounded provider responses. A Wrangler dry run validates the production bundle. Device read and camera playback must additionally be verified after the owner completes Google consent; unit tests do not imply a live connection.

## Native Home approval

`/native/home` remains behind the same whole-host signed Cloudflare Access guard. Only the personal owner can approve a five-minute browser-cookie-bound request initiated by the phone. Explicit approval creates a separate Nest-only application session; the Access identity session and new Nest session are returned only as RSA-OAEP-256/A256GCM ciphertext to a temporary phone public key. No provider Google tokens, station key, budget session or encryption key are returned. The app verifies both protected identity/session endpoints before encrypted storage. There is no public API exception or shared service-token bypass, and Access policy configuration is unchanged. Expired private-site authorization requires another browser approval. The app session can be revoked with the existing `/disconnect` endpoint without removing the website's Nest connection.

`/native/session` reports only the owner email and current Nest session expiry after the existing application-session checks. Native sessions are restricted to this endpoint, device reads, validated thermostat/camera actions and disconnect. Station reads retain the existing five-minute current-observation cache and freshness checks. Approval uses KV only and never reads the budget database. The existing browser OAuth and app sessions are unchanged.

# Sage Cabin private Nest service

Designed for Adam's personal Cloudflare account, on Workers Free + KV Free. The public dashboard stays at https://inkedsage.github.io/Homepage/. No paid plan, stream relay, database, or domain is required for WebRTC cameras. An RTSP-only camera requires a separate gateway and remains an explicit Google Home link here.

## Deployment

1. Sign into the personal account with Wrangler, restricting scopes to account/user reads and Workers/scripts/KV writes.
2. Create a KV namespace and bind it as `NEST_KV`. Set the personal `account_id` and namespace ID in `wrangler.jsonc`.
3. Deploy the Worker; store `GOOGLE_CLIENT_SECRET` and a cryptographically random 32-byte base64 `TOKEN_ENCRYPTION_KEY` as Worker secrets. Never commit either value.
4. Add `https://<worker-host>/auth/callback` as an authorized redirect on the existing Google web OAuth client. Enable Smart Device Management API in `homepage-497902`.
5. Set `NEST_SERVICE_URL` in `js/nest-config.js` to the deployed HTTPS origin. Publish Pages.
6. Connect personal Nest, using abdickers@gmail.com, and explicitly select the thermostat and outdoor camera in Google's Partner Connections Manager.

## Security and limits

- Only the verified owner email can create a Nest connection. Provider access and refresh tokens are encrypted with AES-GCM before KV storage.
- Cookie-bound OAuth state expires after 10 minutes. Application sessions are random, hashed for lookup, and expire after 8 hours. The page keeps its session in memory and clears it on reload. A return link can carry an opaque application session in the fragment when Google severs the popup opener; the dashboard removes that fragment immediately.
- All device API endpoints require a session and the exact dashboard origin. Device commands are allowlisted and temperatures validated. No arbitrary Google API proxy exists.
- Camera sessions belong to the application session that created them. No microphone or browser camera permissions are requested. Nest video/audio is received only. Video closes when the dashboard is hidden and after five minutes; the user can explicitly restart it.
- Device status polls once a minute only while the dashboard is visible. There are no paid scheduled jobs. Free-plan limits stop service when exhausted; don't upgrade the account to bypass them without Adam's approval.
- Disable invocation logs; never log OAuth URLs, authorization headers, tokens, device responses, or SDP. The Worker intentionally emits no payload logs.
- “Sign out” closes the page's session. Persistent Google device permissions can be revoked in Google Home / Partner Connections Manager.

## Validation

`npm test` at repository root includes unauthenticated/session/origin rejection, OAuth state rejection, setpoint bounds and device state, safe device projection, and bounded provider responses. A Wrangler dry run validates the production bundle. Device read and camera playback must additionally be verified after the owner completes Google consent; unit tests do not imply a live connection.

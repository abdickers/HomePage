# Sage's Middle-earth Command

A personal dashboard for [abdickers/HomePage](https://github.com/abdickers/HomePage), privately hosted on [Cloudflare](https://sage-cabin-nest.nest-service.workers.dev/HomePage/). The existing Middle-earth artwork and gold/green styling are preserved.

Cloudflare Zero Trust protects the entire site and gateway. Only `abdickers@gmail.com` and `dickersona@76fireworks.com` can sign in using an emailed one-time PIN; site sessions last seven days. Settings → Connections includes site sign-out. Google/Nest provider consent remains separate. The former GitHub Pages publication is disabled. See [private hosting and verified release](design/PRIVATE-HOSTING.md) for Access configuration, deployment and recovery.

## Use the dashboard

- **Links** open in a separate tab and keep the dashboard available. Use **Add Link** to add, edit, or remove shortcuts in AI Tools, Tools & Systems, and the header. Settings → Preferences → Quick links controls header visibility and order. Use your organization's specific NetSuite, Jira, Confluence, and Slack URLs if you want to skip their workspace chooser.
- **Bag End** uses one shared oak frame, with the hearth and Weather in Rohan grouped on the left and a smaller camera on the right. The camera is bounded to 640px and keeps its 16:9 viewport; these groups stack on smaller screens. The camera selector, Watch/Stop, Refresh, and Google Home actions sit below the video. Watch starts an idle camera; switching a playing camera automatically opens the newly selected feed. Playback contains the full landscape or portrait image without cropping. Leaving the tab, stopping, sign-out and the existing five-minute session limit still end video. Connect Nest once to restore devices automatically on later visits.
- The music, video, System Status, Scribe’s Notes, and Fellowship sections have been removed. Fellowship artwork remains in `assets/avatars/` for future use. Existing tasks and notes remain in browser backups.
- **Search** supports web search, Ask AI, and a Dashboard scope that finds saved links. Press `/` to focus it.
- **Google Keep**, beside the Quartermaster, holds manually saved links to individual Keep notes. Open Keep to create a new note, copy that note's address, then use **Save a note link**. You can edit or remove links, with Undo for removal. The list sorts by your most recent save/open here; it does not sync note content or Google's modification dates. Links are browser-local and included in backups.
- **Settings → Connections** holds Google, Nest, and Treasury source sign-in, sign-out, linking, and sync controls. **Preferences** configures your display name, weather location and units, and calendar. **Backup** holds export and import. **Export Backup** downloads a JSON file; **Import Backup** merges tasks/notes by ID and restores links/settings, with an undo option.
- Tasks, notes, links, settings, and theme are browser-local. They sync between open tabs on the same origin. They do **not** sync across devices or different origins. Older `sage_tasks_v2`, `sage_tasks_v8`, and `sage_notes_v2` data is migrated when available. Export data before changing browsers or clearing site data.

## Dashboard layout

On desktop, Calendar and AI Tools stack on the left beside the Ravens. Bag End follows with hearth / weather beside the smaller Watch at the Gate camera, all inside one frame, then Quartermaster / Quick Access and a full-width News from Bree. Tools & Systems, Warcraft, Treasury, and Words of Wisdom each have a full-width row. Smaller screens follow that same reading order in one column. Personal panels and individual home controls use one oak-and-ivy border. The old Quick Access card has been removed; enabled shortcuts appear in the header. Treasury retains Dwarven artwork, Warcraft retains its existing artwork, and Settings uses silver Gondor trim. The header Palantir uses the same supplied seeing-stone artwork as AI Tools.

## Google Calendar

Gmail and Calendar now share a remembered personal Google connection through `nest-service`. Google access and refresh tokens stay AES-GCM encrypted in the existing private KV namespace. This browser stores only a random, revocable dashboard session bound to the configured gateway. Sessions survive page reloads and renew while active, lasting up to 30 days between renewals. They are not included in dashboard backups. Sign out Google clears the browser credential, revokes that app session, and clears both private views.

Open **Settings → Connections → Connect Gmail & Calendar** in a normal Chrome or Edge tab. Consent requests only OpenID email identity, `gmail.readonly`, and `calendar.events.readonly`; the backend verifies the personal owner and mailbox before saving a connection. It automatically refreshes expired Google access tokens. Calendar uses the selected Calendar ID in Settings. Google sign-in uses the client configured on the private gateway, rather than the legacy browser OAuth client setting. Nest has a separate remembered device connection.

In the Google Cloud project that owns the client ID:

1. Enable Gmail and Google Calendar APIs and configure the OAuth consent screen.
2. Use a **Web application** OAuth client.
3. Authorize `https://sage-cabin-nest.nest-service.workers.dev/auth/callback` as a redirect URI. This existing callback handles both Nest and Gmail/Calendar using cookie-bound, purpose-specific OAuth state. Frontend origin must be exactly `https://sage-cabin-nest.nest-service.workers.dev`; the dashboard return path is `/HomePage/`.
4. Keep the personal Google app in Production for long-lived refresh tokens. Testing mode can expire refresh tokens after seven days. Google may still require reauthorization if access is revoked or its authorization policy expires a grant.

An OAuth client ID is public configuration; never add a client secret. Google sign-in can be blocked inside embedded previews. Use the exact page URL in Chrome or Edge. Existing authorizations for broader scopes are managed in your Google account's third-party connections; the dashboard no longer requests Drive or calendar write access.

Google setup: https://developers.google.com/calendar/api/quickstart/js

## Live widgets

- **Weather:** National Weather Service observations, with Open-Meteo forecast fallback. The configured default is Columbia, MO; change the city and °F/°C in Settings. Units are converted according to the NWS unit codes. Rain means the last hour, and missing measurements stay blank rather than becoming zero. Forecast fallback does not pretend to be a personal weather station. No API key is required.
- **News:** Fox News RSS is read directly; Tech uses the Hacker News API. Wowhead blocks browser RSS requests, so it uses a timestamped public snapshot in `data/news.json`. The hourly `Refresh public news feeds` GitHub Action refreshes real Fox/Wowhead headlines and commits only this public file. The protected Worker supplies that fixed public snapshot without forwarding identity headers or cookies; bot commits do not require redeployment. The action also supports a manual run. Scheduled runs can be delayed or disabled by GitHub after repository inactivity; the displayed timestamp identifies stale snapshots. If feeds fail, their last good snapshot is preserved. No sample headlines are fabricated.
- **Status:** BigCommerce, Vercel, Slack, OpenAI, and Cloudflare are queried using their public status APIs. Incidents link to the provider. NetSuite links to its official status page; blocked/unavailable APIs display **View status**, not an invented operational state. Checks repeat every five minutes.

External APIs can be blocked by browser extensions or provider outages. Refresh controls and source/status links remain available.

## Preview and verify

A static visual preview does not require a build. From the repository root:

```sh
python -m http.server 4173 --bind 127.0.0.1
```

Open `http://127.0.0.1:4173/`. Use an HTTP server rather than opening `index.html` as a file, because the application uses ES modules.

For the full suite and protected deployment, use Node 24 and pinned pnpm 11.25.0:

```sh
pnpm install --frozen-lockfile --ignore-scripts
pnpm test
pnpm check
pnpm build:private
pnpm exec wrangler deploy --config nest-service/wrangler.jsonc --keep-vars --dry-run
# After checks and the repository PR workflow:
pnpm deploy:private
```

Inspect deployed settings first and preserve secrets, KV/D1 bindings and Access protection. The static preview is not an authenticated production environment. Never re-enable GitHub Pages as a deployment step. The news workflow needs Actions enabled and repository `contents: write` permission. It uses the built-in `GITHUB_TOKEN`; no custom secret is needed. Branch rules that prohibit bot commits may require allowing this workflow or running the feed refresher manually and committing its output.

Legacy root SVG files and images are retained for compatibility. The active entry point loads only `css/styles.css` and `js/app.js`.


## Twin command centers (October 15, 2026)

Personal is now https://sage-cabin-nest.nest-service.workers.dev/HomePage/ and uses `abdickers@gmail.com` for its Google integrations. The additional approved work email grants site access, not a different personal Google mailbox.
Work remains owner-private at https://adams-middle-earth-command.spirit-of-76-1921.chatgpt.site/ and uses `dickersona@76fireworks.com`.
The sidebar switches between the two. The artwork, font pair, dark forest surfaces, gold palette, and ornamental borders match Work. `css/realm-theme.css` and `js/account-links.mjs` are copied unchanged to WorkHomepage's `public/realm-theme.css` and `lib/account-links.mjs`.

Google shortcuts carry the realm's email selector, including saved/custom links and individual events. Calendar requests read-only events plus email identity and rejects a different or unverified account before reading any events. The private gateway uses the existing server-side Google callback registered above. Other providers keep their own login sessions; the page cannot read or force those identities. ChatGPT account switching is explicit in the UI, not an invented account-selection URL.

The Quartermaster opens Walmart+ membership and orders and Amazon account/orders/Prime. Spark was removed at the owner’s request. The optional Gmail receipt reader shows actual source emails after personal Google consent; it does not query retailer accounts, balances or live delivery status. No retail credentials are requested or stored.

Frear's companion uses Blizzard's actual public Armory render for Frear, US Grizzly Hills, dwarf paladin. The snapshot shown by Blizzard was updated September 15, 2026. The companion collapses and remembers the preference. This is a rendered image, not an interactive 3D model; the separate Wowhead Dressing Room can load characters. A true animated 3D companion still needs a verified model/appearance export. No Battle.net password is needed. Image source: https://render.worldofwarcraft.com/us/character/grizzly-hills/238/217923310-main-raw.png .

The high-resolution Middle-earth header is reused from WorkHomepage. It is the saved 3840-pixel display derivative of the existing 1672×941 generated artwork, not a newly generated native 4K image. See WorkHomepage's ASSET-NOTES.md. Browser-local tasks, settings and notes from the former GitHub Pages origin can be moved with Export backup and Import backup. Provider tokens and application sessions are not included in backups.

Legacy default work-service tiles on Personal now lead through a single Work Command Center tile. Custom URLs are retained, and tasks/notes are preserved. Personal tools include Battle.net and Frear’s Armory.


## Personal Ravens and shopping receipts

Personal has only Gemini and ChatGPT in its AI section. Removed AI services, Canva, Notion and Obsidian are filtered from saved links and backup imports as well as defaults; the static Notion shortcut and Spark configuration are removed. Work is unchanged.

The Ravens mirrors Work's message cards with Primary and Updates tabs. Each reads the matching unread inbox category from **abdickers@gmail.com**, 20 messages at a time, deduplicated into conversations. More conversations loads the next page. Refresh is on demand; reading does not mark mail read. Every card opens the original Gmail conversation with the personal account selector.

Use **Settings → Connections → Connect Gmail & Calendar**. The receipt widget keeps a refresh action on the dashboard. Gmail and Calendar share the remembered personal Google connection described above. The Google OpenID identity and Gmail mailbox profile must both match the personal email before message reads begin. Raw Google tokens remain encrypted on the private gateway. Mail and receipt content is never written to localStorage, the repository, the Work backend, or AI services. Reload clears the in-memory content and restores the inbox from Google using the saved app session. Receipts are read when requested. Google grants mailbox-wide `gmail.readonly` permission; category/sender queries limit what this page actually reads, not the scope of Google's grant.

Shopping scans the last 180 days for Amazon/Walmart order, receipt, shipping, delivery, pickup and refund emails, 30 messages per page. Sender domains are checked against amazon.com/walmart.com and their subdomains; sender names alone are not trusted. Cards show message date, subject, an order ID if found, and an explicitly labelled unambiguous order total from the plain-text body when available. They are email events, **not current retailer status**. Multiple messages may refer to one order. No spending total is inferred, HTML emails are not executed or displayed, and attachments are not downloaded. Open the source email or retailer Orders link for full details and items.

The Google Cloud owner must enable **Gmail API** and **Google Calendar API** for the OAuth client configured on the private gateway and authorize its exact `/auth/callback` redirect. The consent screen must permit the personal account and both read-only scopes. The UI reports denied or unavailable access instead of showing fake empty results. Live private content still requires the owner's initial Google consent.

Official references: https://developers.google.com/workspace/gmail/api/reference/rest/v1/users.messages/list and https://developers.google.com/workspace/gmail/api/auth/scopes . The discovered Amazon/Walmart order APIs are seller-oriented, not a consumer-account integration. No suitable consumer-order plugin was found in the current plugin discovery results.

## Frear’s War Room

The Personal dashboard has a full-width WoW section with a large, uncropped Armory portrait, character/gear links and a separate 3D dressing-room link. This is still Blizzard’s saved Retail appearance, not an animated model or a Forever character. Switching Retail / WoW Forever remembers the edition locally and changes only the event briefing.

`scripts/refresh-wow.py` reads Wowhead’s public US Today in WoW structured page data and its separate Forever events calendar into `data/wow.json`. GitHub Actions refreshes hourly, preserving each edition’s last successful snapshot independently. No Blizzard secret, login, or character credentials are needed. The Refresh button fetches the latest repository snapshot; it does not initiate an upstream crawl.

Retail shows published event windows, repeating timers, daily reset, weekly bonuses and world activities. Countdowns update every 30 seconds; expired finite windows disappear. Untimed activities are explicitly snapshots; after three hours they say Last known and repeating projections stop. Forever supplies calendar date ranges, not verified exact realm reset/spawn times, so the panel shows dates and a direct source calendar instead of borrowing Retail timers. Source schema changes, missing schedules and portrait failures have visible fallbacks. Source links remain available during outages. Public schedules do not track individual character completion, lockouts or live realm status.

## Combined repository

This repository includes both Bag End / Nest controls (from InkedSage) and Frear’s Retail / Forever War Room. The gateway configuration targets exactly `https://sage-cabin-nest.nest-service.workers.dev` and returns to `/HomePage/` after consent. Build the private asset bundle and deploy `nest-service/wrangler.jsonc` with `--keep-vars`, preserving the existing secrets, KV and D1 bindings. The server-side Google OAuth callback remains on the same Nest service origin. Partner Connections Manager supplies the Nest login hint; the app must not add a duplicate hint.

## Private budget

The Steward adds an authenticated budget ledger backed by the existing Cloudflare Worker, private D1 storage, Plaid Link, and read-only Gmail discovery. See [BUDGET-SETUP.md](BUDGET-SETUP.md) for credential entry, production eligibility and costs, deployment order, privacy controls, and connection verification. Real data is available only after authorized connections; Sandbox data is explicitly labeled.

The Treasury summary defaults to the current Chicago calendar month through today, with optional date ranges. Opening the homepage or restoring Google does not read the budget. Open the Treasury or explicitly load/refresh it to read saved records; source imports run only from explicit connection/sync actions. There is no budget polling, scheduled discovery, or webhook-triggered database work. Selected pages are deduplicated and cached only in page memory; mutations invalidate that cache and closing the Treasury cancels pending reads. View details opens read-only information, while Manage Treasury enables the editors in a separate workspace. The historical tag `treasury-before-summary-20261017` predates private hosting; recovery must preserve the current Access guard as described in [private hosting](design/PRIVATE-HOSTING.md).

Transaction and receipt queries apply indexed owner/kind/date bounds in D1 before loading history. Annotations use primary-key lookups; small saved plans and a bounded upcoming-bill window support forecasts. Bank and Gmail imports use the selected dates, bounded provider pages, and one final snapshot rather than a snapshot per batch. Migration `0002_budget_demand_reads.sql` adds supporting indexes without deleting history. Apply it before deployment when D1 is available; if the daily allowance is exhausted, the next explicit budget load after reset installs missing indexes once. It does not retry in the background. D1 counts rows scanned, including index creation, rather than only rows displayed.

Central Bank exports can be previewed and imported under **Manage Treasury → Spending → Import Central Bank CSV**. The default columns are Date, Description, Amount and Balance; Balance is ignored. Imports have exact signed cents, explicit confirmation, duplicate checks and batch Undo. See [dashboard/CSV review notes](design/DASHBOARD-REVIEW-CSV.md) for source priority, limitations, privacy and visual validation.

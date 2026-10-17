# Sage's Middle-earth Command

A buildless personal dashboard for [abdickers/HomePage](https://github.com/abdickers/HomePage), hosted on [GitHub Pages](https://abdickers.github.io/HomePage/). The existing Middle-earth artwork and gold/green styling are preserved.

## Use the dashboard

- **Links** open in a separate tab and keep the dashboard available. Use **Add Link** to add, edit, or remove shortcuts in AI Tools, Tools & Systems, and Quick Access. Use your organization's specific NetSuite, Jira, Confluence, and Slack URLs if you want to skip their workspace chooser.
- **Bag End** spans the dashboard with thermostat controls beside the private Nest camera. The layout stacks on smaller screens. Connect Nest once to restore devices automatically on later visits.
- The music, video, System Status, Scribe’s Notes, and Fellowship sections have been removed. Fellowship artwork remains in `assets/avatars/` for future use. Existing tasks and notes remain in browser backups.
- **Search** supports web search, Ask AI, and a Dashboard scope that finds saved links. Press `/` to focus it.
- **Settings → Connections** holds Google, Nest, and Treasury source sign-in, sign-out, linking, and sync controls. **Preferences** configures your display name, weather location and units, and calendar. **Backup** holds export and import. **Export Backup** downloads a JSON file; **Import Backup** merges tasks/notes by ID and restores links/settings, with an undo option.
- Tasks, notes, links, settings, and theme are browser-local. They sync between open tabs on the same origin. They do **not** sync across devices or different origins. Older `sage_tasks_v2`, `sage_tasks_v8`, and `sage_notes_v2` data is migrated when available. Export data before changing browsers or clearing site data.

## Dashboard layout

On desktop, Calendar and AI Tools stack on the left beside the Ravens. Bag End follows across the page, then Quartermaster / Quick Access and News from Bree / Weather. Tools & Systems, Warcraft, Treasury, and Words of Wisdom each have a full-width row. Smaller screens follow that same reading order in one column. Quick Access uses the Dwarven frame; Tools & Systems uses the Elven frame. The header Palantir uses the same supplied seeing-stone artwork as AI Tools.

## Google Calendar

Gmail and Calendar now share a remembered personal Google connection through `nest-service`. Google access and refresh tokens stay AES-GCM encrypted in the existing private KV namespace. This browser stores only a random, revocable dashboard session bound to the configured gateway. Sessions survive page reloads and renew while active, lasting up to 30 days between renewals. They are not included in dashboard backups. Sign out Google clears the browser credential, revokes that app session, and clears both private views.

Open **Settings → Connections → Connect Gmail & Calendar** in a normal Chrome or Edge tab. Consent requests only OpenID email identity, `gmail.readonly`, and `calendar.events.readonly`; the backend verifies the personal owner and mailbox before saving a connection. It automatically refreshes expired Google access tokens. Calendar uses the selected Calendar ID in Settings. Google sign-in uses the client configured on the private gateway, rather than the legacy browser OAuth client setting. Nest has a separate remembered device connection.

In the Google Cloud project that owns the client ID:

1. Enable Gmail and Google Calendar APIs and configure the OAuth consent screen.
2. Use a **Web application** OAuth client.
3. Authorize `https://sage-cabin-nest.nest-service.workers.dev/auth/callback` as a redirect URI. This existing callback handles both Nest and Gmail/Calendar using cookie-bound, purpose-specific OAuth state. Frontend origin must be exactly `https://abdickers.github.io`; the dashboard return path is `/HomePage/`.
4. Keep the personal Google app in Production for long-lived refresh tokens. Testing mode can expire refresh tokens after seven days. Google may still require reauthorization if access is revoked or its authorization policy expires a grant.

An OAuth client ID is public configuration; never add a client secret. Google sign-in can be blocked inside embedded previews. Use the exact page URL in Chrome or Edge. Existing authorizations for broader scopes are managed in your Google account's third-party connections; the dashboard no longer requests Drive or calendar write access.

Google setup: https://developers.google.com/calendar/api/quickstart/js

## Live widgets

- **Weather:** National Weather Service observations, with Open-Meteo forecast fallback. The configured default is Columbia, MO; change the city and °F/°C in Settings. Units are converted according to the NWS unit codes. Rain means the last hour, and missing measurements stay blank rather than becoming zero. Forecast fallback does not pretend to be a personal weather station. No API key is required.
- **News:** Fox News RSS is read directly; Tech uses the Hacker News Algolia API. Wowhead blocks browser RSS requests, so it uses a timestamped public snapshot in `data/news.json`. The hourly `Refresh public news feeds` GitHub Action refreshes real Fox/Wowhead headlines and commits only this public file. The live page reads the snapshot from the repository so bot commits do not need to rebuild Pages. The action also supports a manual run. Scheduled runs can be delayed or disabled by GitHub after repository inactivity; the displayed timestamp identifies stale snapshots. If feeds fail, their last good snapshot is preserved. No sample headlines are fabricated.
- **Status:** BigCommerce, Vercel, Slack, OpenAI, and Cloudflare are queried using their public status APIs. Incidents link to the provider. NetSuite links to its official status page; blocked/unavailable APIs display **View status**, not an invented operational state. Checks repeat every five minutes.

External APIs can be blocked by browser extensions or provider outages. Refresh controls and source/status links remain available.

## Preview and verify

No install or build step is required. From the repository root:

```sh
python -m http.server 4173 --bind 127.0.0.1
node --test tests/core.test.js
node --check js/app.js
python scripts/refresh-feeds.py
```

Open `http://127.0.0.1:4173/`. Use an HTTP server rather than opening `index.html` as a file, because the application uses ES modules.

GitHub Pages should publish the `main` branch, repository root. Merge the change to publish the repaired HTML and assets. The news workflow needs Actions enabled and repository `contents: write` permission. It uses the built-in `GITHUB_TOKEN`; no custom secret is needed. Branch rules that prohibit bot commits may require allowing this workflow or running the feed refresher manually and committing its output.

Legacy root SVG files and images are retained for compatibility. The active entry point loads only `css/styles.css` and `js/app.js`.


## Twin command centers (October 15, 2026)

Personal is canonically https://abdickers.github.io/HomePage/ and uses `abdickers@gmail.com`.
Work remains owner-private at https://adams-middle-earth-command.spirit-of-76-1921.chatgpt.site/ and uses `dickersona@76fireworks.com`.
The sidebar switches between the two. The artwork, font pair, dark forest surfaces, gold palette, and ornamental borders match Work. `css/realm-theme.css` and `js/account-links.mjs` are copied unchanged to WorkHomepage's `public/realm-theme.css` and `lib/account-links.mjs`.

Google shortcuts carry the realm's email selector, including saved/custom links and individual events. Calendar requests read-only events plus email identity and rejects a different or unverified account before reading any events. Public OAuth client configuration still requires the Google Cloud owner to authorize the GitHub Pages origin. Other providers keep their own login sessions; the page cannot read or force those identities. ChatGPT account switching is explicit in the UI, not an invented account-selection URL.

The Quartermaster opens Walmart+ membership and orders and Amazon account/orders/Prime. Spark was removed at the owner’s request. The optional Gmail receipt reader shows actual source emails after personal Google consent; it does not query retailer accounts, balances or live delivery status. No retail credentials are requested or stored.

Frear's companion uses Blizzard's actual public Armory render for Frear, US Grizzly Hills, dwarf paladin. The snapshot shown by Blizzard was updated September 15, 2026. The companion collapses and remembers the preference. This is a rendered image, not an interactive 3D model; the separate Wowhead Dressing Room can load characters. A true animated 3D companion still needs a verified model/appearance export. No Battle.net password is needed. Image source: https://render.worldofwarcraft.com/us/character/grizzly-hills/238/217923310-main-raw.png .

The high-resolution Middle-earth header is reused from WorkHomepage. It is the saved 3840-pixel display derivative of the existing 1672×941 generated artwork, not a newly generated native 4K image. See WorkHomepage's ASSET-NOTES.md. The live personal dashboard remains on the abdickers origin. Browser-local tasks, settings and notes from the temporary abdickers deployment can be moved with Export backup and Import backup.

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

This repository includes both Bag End / Nest controls (from InkedSage) and Frear’s Retail / Forever War Room. The gateway configuration targets exactly `https://abdickers.github.io` and returns to `/HomePage/` after consent. Deploy `nest-service/wrangler.jsonc` with `--keep-vars`, preserving the existing secrets and KV namespace. The server-side Google OAuth callback remains on the existing Nest service origin. Partner Connections Manager supplies the Nest login hint; the app must not add a duplicate hint.

## Private budget

The Steward adds an authenticated budget ledger backed by the existing Cloudflare Worker, private D1 storage, Plaid Link, and read-only Gmail discovery. See [BUDGET-SETUP.md](BUDGET-SETUP.md) for credential entry, production eligibility and costs, deployment order, privacy controls, and connection verification. Real data is available only after authorized connections; Sandbox data is explicitly labeled.

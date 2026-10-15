# Sage's Middle-earth Command

A buildless personal dashboard for [abdickers/HomePage](https://github.com/abdickers/HomePage), hosted on [GitHub Pages](https://abdickers.github.io/HomePage/). The existing Middle-earth artwork and gold/green styling are preserved.

## Use the dashboard

- **Links** open in a separate tab and keep the dashboard available. Use **Add Link** to add, edit, or remove shortcuts in AI Tools, Tools & Systems, and Quick Access. Use your organization's specific NetSuite, Jira, Confluence, and Slack URLs if you want to skip their workspace chooser.
- **Tasks** support completion, priority stars, optional due dates, Today/Upcoming lists, clearing completed tasks, and undo. Completing a task never modifies a calendar event.
- **Notes** open in a styled editor and support multiline text, editing, deletion, and undo.
- **Search** supports web search, Ask AI, and a Dashboard scope that finds saved links, tasks, and notes. Press `/` to focus it.
- **Settings** configures your display name, weather location and units, and calendar. **Export Backup** downloads a JSON file; **Import Backup** merges tasks/notes by ID and restores links/settings, with an undo option.
- Tasks, notes, links, settings, and theme are browser-local. They sync between open tabs on the same origin. They do **not** sync across devices or different origins. Older `sage_tasks_v2`, `sage_tasks_v8`, and `sage_notes_v2` data is migrated when available. Export data before changing browsers or clearing site data.

## Google Calendar

The existing public Web OAuth client ID is retained in `js/core.js` and can be replaced in Settings. No secret or access token is stored in the repository or localStorage. Calendar tokens remain in memory until disconnect, expiry, or page reload.

Use **Connect Calendar** in a normal Chrome or Edge tab. This requests only `calendar.events.readonly`, verifies the grant, and shows events for the selected day. Navigate days with the arrows or return to Today. The Open Google Calendar link works even while disconnected.

In the Google Cloud project that owns the client ID:

1. Enable the Google Calendar API and configure the OAuth consent screen.
2. Use a **Web application** OAuth client.
3. Add `https://abdickers.github.io` as an authorized JavaScript origin. Add `http://127.0.0.1:4173` and/or `http://localhost:4173` for local preview. Origins do not include `/HomePage/`.
4. Add your account as a test user if the app is in Testing mode.

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

# Pocket Command for Android

Native dashboard app with **The Shire** and **Gondor Command** home-screen widgets. Android 11 or newer; built for a Pixel-sized screen. No Play Store publication is required: install the APK directly.

## Install and use

1. Download the `pocket-command-apk-and-emulator-proof` artifact from the successful **Build and emulate Pocket Command** Actions run. Extract `app-debug.apk` and transfer it to your phone.
2. Open the APK and approve installation on the phone. This is a signed **test build**, not a Play Store release. Your phone may ask you to allow installation from the app opening the APK; make that choice yourself.
3. Open **Pocket Command**, select The Shire or Gondor Command, and tap **Sync widget**.
4. Sign in in the browser using your existing Cloudflare or ChatGPT access. Let the information load. For work project status, select the project view you want first.
5. Tap **Save to phone** in the sync panel. The app verifies the one-use handoff, saves a bounded snapshot locally, and updates that realm's widget. If sign-in removed the sync panel, return to the app and tap Sync again after signing in.
6. Tap **Add widget**, or long-press a free area of the Pixel home screen → Widgets → Pocket Command. Add each realm separately. Resize each to fill its home-screen page's available area. Android's launcher controls the maximum size; widgets do not replace the dock or system bars.

## What is included

- Personal: current station weather, today's calendar, thermostat status, mail subject summaries, and app names when already loaded in the website.
- Work: the selected production/project view, today's calendar, mail subject summaries, quests, and priorities when rendered.
- Branded backgrounds and emblems, native quick access buttons, separate widget instances, sync timestamps, offline cached viewing, and Clear saved data.
- **No Treasury, transactions, budget, account balance, or Warcraft.** Banking was optional and is deliberately not connected in this version.

## Privacy and data use

The native app and widgets make **no background network calls**. Sync opens the existing website in the user's actual browser, retaining its existing Cloudflare / ChatGPT protection. The browser exports only the listed, already-rendered summary after an explicit tap. This script itself performs no API requests. Normal website reads still occur while that website is open. Work's special sync visit disables its periodic mail/quest watch and does not mount the invoice Treasury.

No service tokens, Access cookies, OAuth tokens, passwords, or API keys enter the APK or widget. Each export is bound to a cryptographically random pending nonce and realm, expires after ten minutes, and is accepted once. The explicit Android package in the handoff prevents interception by another handler. The nonce prevents unsolicited websites from overwriting the snapshot; it is not a server signature. A compromised authenticated dashboard remains a trusted-source compromise.

Snapshots are stored in the app-private sandbox, excluded from Android cloud backup, and can be cleared inside the app. They remain visible on an unlocked home screen until cleared. A sync timestamp is not an assertion that the source provider just refreshed: stale/unavailable source messages are retained. **Sync is manual**, not a continuous live feed. Nothing is presented as real data before the first successful sync.

## Build and verification

JDK 17 and Android SDK 35 are required. The checked-in Gradle wrapper has a distribution checksum.

```sh
cd android
./gradlew testDebugUnitTest lintDebug assembleDebug assembleDebugAndroidTest
```

The Actions workflow boots an Android 35 emulator at 1280×2856, then tests a narrower display with larger text. Instrumentation verifies native screens, both real `AppWidgetHost` providers at three sizes, and rejection of forged, expired, cross-realm, and replayed callbacks. Screenshots contain explicitly labeled synthetic data. Compile/emulator checks do not prove the user's real Cloudflare / ChatGPT sign-in or Pixel launcher behavior; those require the user's phone and authenticated sessions.

The downloadable test APK is debug-signed. Fresh CI runners can use different debug signing certificates; do not rely on this for long-term upgrades. Export or clear local snapshots before uninstalling a test build. A persistent private release signing key should be configured before distributing ongoing updates; no signing key is committed or uploaded with the app.

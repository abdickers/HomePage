# The Shire — actual Personal website app

Opens the live Shire dashboard immediately, using its existing Elven design, layout, information and functional controls. No native replica, snapshot UI, or home-screen widget. The website is the app's content.

The fixed destination is `https://sage-cabin-nest.nest-service.workers.dev/HomePage/?app=personal`. Only this app-mode URL hides Warcraft and Treasury; it skips their JavaScript initialization and Warcraft schedule requests. Ordinary website visits retain both sections. No account balance, transaction history, or bank connection is added.

Cloudflare Access, Google/Nest permissions and existing protections remain unchanged. The app uses the actual browser's session; it never extracts cookies or embeds Access/OAuth secrets. Chrome's security toolbar may remain visible, especially during sign-in; it can hide on scroll. **This is not guaranteed borderless fullscreen.** External provider sign-in stays in the real browser. No credentials, CAPTCHA, or MFA are completed by automated tests.

## Install

Extract `Shire-Personal-Install.zip` and open its APK on the Pixel. Open **The Shire**, complete Cloudflare sign-in with the authorized personal account, then use the dashboard directly. A browser already signed into the private homepage may reuse that session. No Sync widget or Save to phone step exists.

This is a directly installed signed test APK, without Play Console publication. It uses a separate package from Gondor Command and the rejected Pocket Command snapshot app. Debug signing certificates can differ between builds; configure a persistent private release key before ongoing updates. Uninstalling an old unrelated Pocket Command test is optional.

## Verification

CI builds/lints the app, runs its fixed-destination test, and boots two separate Android 35 emulators at Pixel-sized and narrow/large-text settings. It checks the real Personal/Cloudflare login origin and records screenshots. It cannot claim completed user sign-in or authenticated thermostat/camera/calendar/mail verification without a real signed-in phone session.

The existing website tests cover data behavior and app-mode isolation. Browser preview verifies the actual website layout with test fixtures; fixtures are not real account data and are excluded from deployment. Native home-screen widgets cannot host an interactive website.

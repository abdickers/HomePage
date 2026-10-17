# Settings and control polish — October 16, 2026

The existing hero, artwork, email sources, Warcraft links, and device controls are retained. Google, Nest, and budget source administration now lives in Settings → Connections. Preferences and backup have separate keyboard-accessible tabs. Income, cushion, and limits remain in the Treasury's Plans view. Dashboard refresh and everyday controls remain available.

## Verification

- All 105 existing Node tests pass, including account isolation, budget calculations, remembered sessions, Nest state presentation, Treasury disclosure, and mail clearing. The mail-controller test also checks that signed-out receipt refresh cannot start OAuth or read messages.
- Syntax checks pass for the five changed JavaScript modules. HTML has unique IDs, its local references resolve, and all static link destinations are preserved. The removed `calendarDisconnect` control is replaced by the shared Google sign-out action in Settings.
- Browser inspection at 390, 768, 1440, and 1920 CSS pixels found no horizontal page overflow. Inspected Settings, inputs, long email subjects, Bree parchment cards, fixed frame ornaments, and compact date navigation. The board uses one column where two readable cards cannot fit; phone framing crops the outer scene without squeezing the actual board.
- Arrow keys, Home, and End move between Settings tabs; inactive panels use `hidden`. Escape closes Settings and restores the original opener. Native modal focus containment is preserved.
- A local, ignored fixture uses the actual mail, budget, Nest, and Settings controllers with synthetic data. Verified coverage feedback, account inclusion changes, and sync dispatch from the moved controls. A simulated Plaid Link verifies that Settings releases the native modal while Link is open, then restores the bank control on exit.
- Fixture Google sign-out clears the rendered inbox and budget sources; amounts remain masked by the existing privacy state. The production entry point starts without JavaScript console errors and renders actual public news and weather. No new motion was introduced.

## Scope and limits

No backend, provider scopes, API endpoints, credentials, database schema, financial calculations, or Nest activity logic were changed. Source artwork and approved derivatives were reused unchanged. Local private-control checks use synthetic data; this verification does not claim a fresh live Google, bank, or Nest authorization. No private data, screenshots, or fixture files are committed.

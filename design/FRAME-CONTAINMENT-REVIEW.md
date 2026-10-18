# Frame interiors and Ravens scroll

The Shire's ornamental panels now paint their backgrounds on separate,
noninteractive `panel-surface` layers. Their insets follow the measured quiet
rails of the Elven, Dwarven, Hobbit oak, and Warcraft source sheets. Panel
boxes remain transparent and unclipped; ornaments and keyboard focus can
extend naturally. The nested weather panel, both Treasury disclosure states,
and Warcraft story cards are covered too. The cathedral artwork is retained.

The supplied Ravens scroll is preserved as `assets/ravens-scroll.png`
(1254×1254 RGBA). Its WebP delivery derivative preserves alpha exactly. A
square wrapper contains the proportional image and an independent HTML
reading area inset 16% vertically and 13% horizontally. The list scrolls at
wide component sizes; at 720px or narrower the whole inset scrolls so fixed
headings and controls cannot squeeze out the messages. There is no backing
paper rectangle, assembled roller, raised message card, or red seal badge.

Verification:

- All 128 existing tests, application/mail syntax checks, the private static
  build, Wrangler strict deployment dry-run, and `git diff --check` passed.
- Inspected all eleven ornamental panel interiors at 375, 768, and 1440px;
  also checked the populated scroll at 1920px. No horizontal page overflow.
- Reviewed actual upper-left/lower-right corners against the surrounding page,
  plus the closed and expanded Treasury. Parent panel backgrounds are empty;
  their paint layers stay inside the visible rails.
- Used an ignored local fixture and the unchanged real mail controller with
  synthetic mailbox responses. Checked populated, loading, empty and error
  states, recovery, Primary/Updates, refresh, pagination (14 → 28 rows), and
  original-message link attributes. No private email was saved in fixtures.
- At 375, 768 and 1440px, keyboard focus scrolled the Refresh control into the
  parchment safe area with its visible outline. Message text wraps and the
  scroll image retains a 1:1 aspect ratio. All existing HTML IDs are preserved.
- Browser zoom shortcuts did not change the in-app browser's scale, so native
  200% zoom is unverified. Narrow reflow and reachable controls were checked.

No JavaScript, provider, authentication, financial, camera, or synchronization
logic changed. QA fixtures and screenshots remain excluded from publication.

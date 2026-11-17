/* Runs before styles so a remembered realm never flashes the Elven artwork. */
(() => {
  'use strict';
  const key = 'sage_visual_theme_v1';
  const names = Object.freeze({hobbit:'Hobbit', gondor:'Gondor', dwarven:'Dwarven', elven:'Elven'});
  const root = document.documentElement;
  const valid = value => Object.hasOwn(names, value) ? value : 'elven';
  let initial = 'elven';
  try { initial = valid(localStorage.getItem(key)); } catch {}
  root.dataset.visualTheme = initial;
  const originals = new WeakMap();
  const protectedSelector = '#wowPanel,#budgetPanel,#budgetWorkspace,#budgetDialog';
  function artworkPath(theme, name) {
    const extension = theme === 'gondor' && ['refresh','settings'].includes(name) ? 'svg' : 'webp';
    return `assets/themes/${theme}/icon-${name}.${extension}`;
  }
  function updateArtwork() {
    const theme = root.dataset.visualTheme;
    for (const image of document.querySelectorAll('img,source')) {
      if (image.closest(protectedSelector)) continue;
      if (!originals.has(image)) {
        const src = image.getAttribute('src');
        const srcset = image.getAttribute('srcset');
        const match = src?.match(/assets\/valinor\/icon-([a-z-]+)\.webp/);
        const emblem = image.classList.contains('bag-end-emblem') || src?.endsWith('/two-trees-emblem.webp');
        const scenery = image.closest('#nestCameraArt');
        const scroll = image.classList.contains('ravens-scroll-art');
        const hearth = image.id === 'nestModeArt';
        const footer = image.closest('#realmFooter');
        const sidebar = image.dataset.sidebarIcon;
        if (!match && !emblem && !scenery && !scroll && !hearth && !sidebar && !footer) continue;
        originals.set(image, {src,srcset,icon:emblem ? 'home' : match?.[1],scenery,scroll,hearth,sidebar,footer});
      }
      const original = originals.get(image);
      if (original.hearth) {
        const current = image.getAttribute('src');
        if (current && current.startsWith('assets/expansion/') && current !== original.src) {
          original.src = current; original.srcset = image.getAttribute('srcset');
        }
      }
      let src = original.src, srcset = original.srcset;
      if (original.footer && theme !== 'elven') {
        const path = theme === 'gondor' ? 'assets/themes/gondor/sidebar-crest.webp' : artworkPath(theme,'home');
        src = original.src ? path : null;
        srcset = original.srcset ? path + ' 160w' : null;
      } else if (original.sidebar && ['gondor','elven'].includes(theme)) {
        src = `assets/themes/${theme}/sidebar-icon-${original.sidebar}.webp`; srcset = null;
      } else if (theme !== 'elven') {
        if (original.scroll) { src = `assets/themes/${theme}/scroll.webp`; srcset = null; }
        else if (original.hearth) {
          const family = theme === 'gondor' ? 'dwarven' : theme;
          const state = original.src?.includes('cooling') ? 'cool' : 'heat';
          src = original.src ? `assets/themes/${family}/hearth-${state}.webp` : null; srcset = null;
        } else if (original.scenery) {
          src = original.src ? `assets/themes/${theme}/${theme === 'gondor' ? 'header.webp' : 'background-1672.webp'}` : null;
          srcset = original.srcset ? `assets/themes/${theme}/${theme === 'gondor' ? 'header.webp' : 'background-960.webp'}` : null;
        } else if (original.icon) {
          src = artworkPath(theme, original.icon);
          srcset = original.srcset ? src + ' 160w' : null;
        }
      }
      for (const [attribute,value] of [['src',src],['srcset',srcset]]) {
        if (value === null) { if (image.hasAttribute(attribute)) image.removeAttribute(attribute); }
        else if (image.getAttribute(attribute) !== value) image.setAttribute(attribute,value);
      }
    }
  }
  function apply(value, {save = false, announce = false} = {}) {
    const theme = valid(value);
    root.dataset.visualTheme = theme;
    // The old hidden ember switch must not tint a selected visual theme.
    document.body?.classList.remove('ember-mode');
    let remembered = true;
    if (save) { try { localStorage.setItem(key,theme); } catch { remembered = false; } }
    for (const button of document.querySelectorAll('[data-visual-theme-button]')) {
      button.setAttribute('aria-pressed',String(button.dataset.visualThemeButton === theme));
    }
    const select = document.getElementById('visualTheme');
    if (select) select.value = theme;
    updateArtwork();
    const status = document.getElementById('themeStatus');
    if (announce && status) status.textContent = `${names[theme]} theme selected.${remembered ? '' : ' Browser storage is unavailable; this change lasts for this visit.'}`;
  }
  function ready() {
    apply(root.dataset.visualTheme);
    document.addEventListener('click',event => {
      const button = event.target.closest('[data-visual-theme-button]');
      if (button) apply(button.dataset.visualThemeButton,{save:true,announce:true});
    });
    document.getElementById('visualTheme')?.addEventListener('change',event => apply(event.target.value,{save:true,announce:true}));
    window.addEventListener('storage',event => {
      if (event.key === key || event.key === null) apply(event.newValue);
    });
    // Newly added shortcuts may include a theme icon; keep their original source
    // so selecting Elven restores it exactly. Attribute writes are idempotent.
    new MutationObserver(updateArtwork).observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['src','srcset']});
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',ready,{once:true});
  else ready();
})();

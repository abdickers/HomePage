/* Decorative clockwork only: device state, data and controls stay in app.js. */
(() => {
  'use strict';
  const root = document.documentElement;
  let built = false;
  let visibility;

  function assembly(target, position) {
    if (!target) return;
    const group = document.createElement('span');
    group.className = `steampunk-clockwork steampunk-clockwork--${position}`;
    group.setAttribute('aria-hidden', 'true');
    for (const size of ['large', 'small', 'idler']) {
      const gear = document.createElement('span');
      gear.className = `steampunk-gear steampunk-gear--${size}`;
      group.append(gear);
    }
    target.append(group);
    visibility?.observe(group);
  }

  function sync() {
    const active = root.dataset.visualTheme === 'steampunk';
    root.toggleAttribute('data-clockwork-paused', !active || document.hidden);
    if (!active || built) return;
    built = true;
    // No perpetual JavaScript loop. The compositor rotates the SVG wheels;
    // intersection and page visibility pause machinery that cannot be seen.
    if ('IntersectionObserver' in window) {
      visibility = new IntersectionObserver(entries => {
        for (const entry of entries) entry.target.toggleAttribute('data-clockwork-paused', !entry.isIntersecting);
      });
    }
    assembly(document.getElementById('realmHeader'), 'header');
    assembly(document.querySelector('.realm-ring'), 'crest');
    assembly(document.getElementById('homePanel'), 'home');
    assembly(document.querySelector('.realm-sidebar'), 'cabinet');
  }
  new MutationObserver(sync).observe(root, {attributes:true, attributeFilter:['data-visual-theme']});
  document.addEventListener('visibilitychange', sync);
  sync();
})();

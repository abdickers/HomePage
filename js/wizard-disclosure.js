// Header presentation only. Existing Settings and provider links keep their handlers.
export function initWizardDisclosure(root = document) {
  const trigger = root.getElementById('wizardTrigger');
  const panel = root.getElementById('wizardActions');
  const settings = root.getElementById('settingsDialog');
  if (!trigger || !panel) return;
  let settingsFromWizard = false;
  const close = (restoreFocus = false) => {
    panel.hidden = true;
    trigger.setAttribute('aria-expanded', 'false');
    if (restoreFocus) trigger.focus({preventScroll: true});
  };
  trigger.addEventListener('click', () => {
    const open = trigger.getAttribute('aria-expanded') !== 'true';
    panel.hidden = !open;
    trigger.setAttribute('aria-expanded', String(open));
  });
  root.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !panel.hidden) {
      event.preventDefault();
      close(true);
    }
  });
  root.addEventListener('pointerdown', event => {
    if (!panel.hidden && !panel.contains(event.target) && !trigger.contains(event.target)) close();
  });
  root.addEventListener('focusin', event => {
    if (!panel.hidden && !panel.contains(event.target) && !trigger.contains(event.target)) close();
  });
  panel.addEventListener('click', event => {
    const action = event.target.closest('a,button');
    if (!action) return;
    // The existing Settings listener runs at the target. Restore to the visible
    // trigger after that dialog closes, never to its now-hidden menu item.
    settingsFromWizard = action.id === 'settingsOpen';
    close(!settingsFromWizard);
  });
  settings?.addEventListener('close', () => {
    if (settingsFromWizard) {
      settingsFromWizard = false;
      trigger.focus({preventScroll: true});
    }
  });
}

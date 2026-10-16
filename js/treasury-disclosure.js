// A visual disclosure only. Authentication, loading, and amount privacy remain
// owned by the original budget module. There is exactly one budget DOM tree.
export function initTreasuryDisclosure(doc=document, win=window) {
  const entrance=doc.getElementById('treasuryEntrance'),content=doc.getElementById('treasuryContent'),close=doc.getElementById('treasuryClose');
  if(!entrance||!content||!close)return;
  const panel=doc.getElementById('budgetPanel'),veil=doc.getElementById('treasuryTransition');
  let timer;
  function setOpen(open) {
    clearTimeout(timer);
    const restore=content.contains(doc.activeElement);
    entrance.setAttribute('aria-expanded',String(open));
    entrance.hidden=open; content.hidden=!open; content.inert=!open;
    panel.classList.toggle('is-open',open);
    panel.classList.remove('is-opening');veil.hidden=true;
    if(open) {
      if(!win.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        veil.hidden=false;panel.classList.add('is-opening');
        timer=win.setTimeout(()=>{panel.classList.remove('is-opening');veil.hidden=true;},280);
      }
      close.focus({preventScroll:true});
    } else if(restore) entrance.focus();
  }
  content.hidden=true;content.inert=true;entrance.hidden=false;entrance.setAttribute('aria-expanded','false');
  entrance.addEventListener('click',()=>setOpen(true));
  close.addEventListener('click',()=>setOpen(false));
  return {setOpen};
}

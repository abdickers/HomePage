// Presentation only: the original controllers own connection state and actions.
export function initSettingsPresentation(doc=document) {
  const dialog=doc.getElementById('settingsDialog');
  const tabs=[...dialog.querySelectorAll('[data-settings-tab]')];
  const panels=[...dialog.querySelectorAll('[data-settings-panel]')];
  function select(name,{focus=false}={}) {
    const selected=tabs.find(tab=>tab.dataset.settingsTab===name)||tabs[0];
    const changed=selected.getAttribute('aria-selected')!=='true';
    for(const tab of tabs){const active=tab===selected;tab.setAttribute('aria-selected',String(active));tab.tabIndex=active?0:-1;}
    for(const panel of panels)panel.hidden=panel.dataset.settingsPanel!==selected.dataset.settingsTab;
    if(changed||!dialog.open)dialog.querySelector('.settings-body').scrollTop=0;
    if(focus)selected.focus();
  }
  tabs.forEach((tab,index)=>{
    tab.addEventListener('click',()=>select(tab.dataset.settingsTab));
    tab.addEventListener('keydown',event=>{
      const next=event.key==='Home'?0:event.key==='End'?tabs.length-1:event.key==='ArrowRight'?(index+1)%tabs.length:event.key==='ArrowLeft'?(index+tabs.length-1)%tabs.length:-1;
      if(next<0)return;event.preventDefault();select(tabs[next].dataset.settingsTab,{focus:true});
    });
  });
  function mirror(sourceId,targetId) {
    const source=doc.getElementById(sourceId),target=doc.getElementById(targetId);
    if(!source||!target)return;
    const update=()=>{target.textContent=source.textContent;target.classList.toggle('budget-error',source.classList.contains('budget-error'));};
    update();new MutationObserver(update).observe(source,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['class']});
  }
  mirror('nestStatus','nestConnectionStatus');mirror('budgetState','budgetSettingsState');
  const google=doc.getElementById('mailConnect'),status=doc.getElementById('googleConnectionStatus');
  const googleStatus=()=>{status.textContent=google.textContent==='Personal Google connected'?'Connected · personal Gmail & Calendar':google.disabled?'Preparing personal Google sign-in…':'Not connected · sign in below';};
  googleStatus();new MutationObserver(googleStatus).observe(google,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['disabled']});
  select('connections');return {select};
}

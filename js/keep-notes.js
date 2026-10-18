import {escapeHtml as esc} from './core.js?v=20261018-bagend4';
import {KEEP_HOME,keepNoteUrl,recentKeepLinks} from './keep-notes-data.js?v=20261018-bagend4';

export function initKeepNotes({getData,persist,toast,doc=document}) {
  const list=doc.getElementById('keepNoteLinks'),form=doc.getElementById('keepLinkForm');
  const editor=doc.getElementById('keepLinkEditor'),error=doc.getElementById('keepLinkError');
  const title=doc.getElementById('keepLinkTitle'),url=doc.getElementById('keepLinkUrl'),id=doc.getElementById('keepLinkId');
  doc.getElementById('keepOpen').href=KEEP_HOME;
  function reset(){form.reset();id.value='';error.textContent='';url.removeAttribute('aria-invalid');editor.open=false;}
  function render() {
    const links=recentKeepLinks(getData().keepLinks);
    list.innerHTML=links.length?links.map(link=>{
      const opened=Date.parse(link.openedAt)>Date.parse(link.savedAt),stamp=opened?link.openedAt:link.savedAt;
      const when=stamp?new Date(stamp).toLocaleDateString([],{month:'short',day:'numeric'}):'';
      return `<li><a class="keep-note-link" href="${esc(link.url)}" target="_blank" rel="noopener noreferrer" data-open-keep="${esc(link.id)}"><strong>${esc(link.title)}</strong><small>${when?`${opened?'Opened here':'Saved here'} · ${esc(when)}`:'Saved note link'}<span aria-hidden="true"> ↗</span></small></a><div class="keep-note-actions"><button type="button" data-edit-keep="${esc(link.id)}" aria-label="Edit note link ${esc(link.title)}">Edit</button><button type="button" data-remove-keep="${esc(link.id)}" aria-label="Remove note link ${esc(link.title)}">×</button></div></li>`;
    }).join(''):'<li class="keep-empty">Keep useful notes close. Open Google Keep to create a note, then save its link here.</li>';
  }
  form.addEventListener('submit',event=>{
    event.preventDefault();const destination=keepNoteUrl(url.value),name=title.value.trim(),data=getData();
    if(!destination||!name){error.textContent='Enter a title and the full address of an individual Google Keep note (https://keep.google.com/…#NOTE/…).';url.setAttribute('aria-invalid','true');url.focus();return;}
    const existing=data.keepLinks.find(link=>link.id===id.value);
    if(!existing&&data.keepLinks.length>=100){error.textContent='You have 100 saved note links. Remove one before adding another.';return;}
    const duplicate=data.keepLinks.find(link=>link.url===destination&&link.id!==id.value);
    if(duplicate){error.textContent='That note is already saved. Use Edit beside its title to update it.';return;}
    const link={id:existing?.id||crypto.randomUUID(),title:name.slice(0,100),url:destination,savedAt:new Date().toISOString(),openedAt:existing?.openedAt||''};
    if(existing)data.keepLinks=data.keepLinks.map(item=>item===existing?link:item);else data.keepLinks.push(link);
    const saved=persist();render();reset();doc.getElementById('keepLinkSummary').focus();if(saved)toast('Keep note link saved.');
  });
  list.addEventListener('click',event=>{
    const open=event.target.closest('[data-open-keep]'),edit=event.target.closest('[data-edit-keep]'),remove=event.target.closest('[data-remove-keep]');
    const key=open?.dataset.openKeep||edit?.dataset.editKeep||remove?.dataset.removeKeep;
    const data=getData(),link=data.keepLinks.find(link=>link.id===key);if(!link)return;
    if(open){link.openedAt=new Date().toISOString();persist();setTimeout(()=>{const focused=doc.activeElement===open;render();if(focused)[...list.querySelectorAll('[data-open-keep]')].find(element=>element.dataset.openKeep===link.id)?.focus({preventScroll:true});},0);}
    else if(edit){id.value=link.id;title.value=link.title;url.value=link.url;error.textContent='';url.removeAttribute('aria-invalid');editor.open=true;title.focus();}
    else {
      data.keepLinks=data.keepLinks.filter(item=>item!==link);const saved=persist();render();doc.getElementById('keepLinkSummary').focus();
      if(saved)toast('Note link removed.',()=>{const current=getData();if(!current.keepLinks.some(item=>item.id===link.id))current.keepLinks.push(link);persist();render();});
    }
  });
  doc.getElementById('keepLinkCancel').addEventListener('click',reset);
  render();return {render};
}

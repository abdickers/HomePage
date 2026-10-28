import {escapeHtml as esc} from './core.js?v=20261018-bagend4';
import {LINK_ICONS, headerLinks, normalizeQuickLinks, linkIcon, internalLink} from './quick-links.js?v=20261028-apps1';
import {accountLink, PERSONAL_EMAIL} from './account-links.mjs?v=20261015-personal7';

export const linkDestination = link => internalLink(link.url) || accountLink(link.url,PERSONAL_EMAIL,link.name);
export function linkArtwork(link, kind) {
  return `<span class="${kind}" aria-hidden="true"><img src="${esc(linkIcon(link))}" alt="" width="26" height="26" decoding="async" /><span class="icon-fallback" hidden>↗</span></span>`;
}
export function initQuickLinks({getData, openEditor, doc=document}) {
  const strip=doc.getElementById('headerQuickLinks'), list=doc.getElementById('quickLinkSettings');
  const status=doc.getElementById('quickLinkOrderStatus');
  let draft;
  const iconSelect=doc.getElementById('linkIcon');
  iconSelect.innerHTML=Object.entries(LINK_ICONS).map(([id,[name]])=>`<option value="${id}">${name}</option>`).join('');
  function renderHeader() {
    const data=getData(), links=headerLinks(data.links,data.settings.quickLinks);
    strip.hidden=!links.length;
    const shortcut=link=>`<a class="header-shortcut" href="${esc(linkDestination(link))}" ${internalLink(link.url)?'':'target="_blank" rel="noopener noreferrer"'} aria-label="${esc(link.name)}">${linkArtwork(link,'shortcut-art')}<span class="shortcut-tooltip" role="tooltip">${esc(link.name)}</span></a>`;
    const primary=links.length>10?links.slice(0,9):links,overflow=links.length>10?links.slice(9):[];
    strip.innerHTML=primary.map(shortcut).join('')+(overflow.length?`<details class="shortcut-more"><summary class="header-shortcut" aria-label="More quick links"><span aria-hidden="true">⋯</span><span class="shortcut-tooltip" role="tooltip">More quick links</span></summary><div class="shortcut-overflow" aria-label="More quick links">${overflow.map(shortcut).join('')}</div></details>`:'');
  }
  strip.addEventListener('keydown',event=>{const more=strip.querySelector('.shortcut-more[open]');if(event.key==='Escape'&&more){event.preventDefault();more.open=false;more.querySelector('summary').focus();}});
  doc.addEventListener('pointerdown',event=>{const more=strip.querySelector('.shortcut-more[open]');if(more&&!more.contains(event.target))more.open=false;});
  doc.addEventListener('focusin',event=>{const more=strip.querySelector('.shortcut-more[open]');if(more&&!more.contains(event.target))more.open=false;});
  function renderSettings() {
    const data=getData(); draft=normalizeQuickLinks(draft,data.links);
    const byId=new Map(data.links.map(link=>[link.id,link]));
    list.innerHTML=draft.items.map((item,index)=>{const link=byId.get(item.id);return `<li data-link-id="${esc(item.id)}">${linkArtwork(link,'settings-link-art')}<div class="settings-link-name"><strong>${esc(link.name)}</strong><span>${esc(linkDestination(link))}</span></div><label class="quick-link-switch"><input type="checkbox" role="switch" data-quick-toggle="${esc(item.id)}" aria-label="Show ${esc(link.name)} in header" ${item.enabled?'checked':''} /><span aria-hidden="true"></span></label><div class="quick-link-order"><button type="button" data-quick-move="up" data-id="${esc(item.id)}" aria-label="Move ${esc(link.name)} up" ${index===0?'disabled':''}>↑<span>Move up</span></button><button type="button" data-quick-move="down" data-id="${esc(item.id)}" aria-label="Move ${esc(link.name)} down" ${index===draft.items.length-1?'disabled':''}>↓<span>Move down</span></button></div></li>`;}).join('') || '<li>No saved links. Use Manage links to add one.</li>';
  }
  list.addEventListener('change',event=>{
    const input=event.target.closest('[data-quick-toggle]'); if(!input)return;
    const item=draft.items.find(item=>item.id===input.dataset.quickToggle);if(item)item.enabled=input.checked;
  });
  list.addEventListener('click',event=>{
    const button=event.target.closest('[data-quick-move]');if(!button||button.disabled)return;
    const index=draft.items.findIndex(item=>item.id===button.dataset.id), next=index+(button.dataset.quickMove==='up'?-1:1);
    if(index<0||next<0||next>=draft.items.length)return;
    [draft.items[index],draft.items[next]]=[draft.items[next],draft.items[index]];
    const name=getData().links.find(link=>link.id===button.dataset.id).name;
    renderSettings();const row=[...list.children].find(row=>row.dataset.linkId===button.dataset.id);
    const target=row.querySelector(`[data-quick-move="${button.dataset.quickMove}"]`);
    (target.disabled?row.querySelector('input'):target).focus();
    status.textContent=`${name} moved to position ${next+1}. Save preferences to apply.`;
  });
  doc.getElementById('quickLinksManage').addEventListener('click',openEditor);
  return {
    renderHeader,
    begin(){draft=structuredClone(getData().settings.quickLinks);status.textContent='';renderSettings();},
    refresh(){renderHeader();if(draft)renderSettings();},
    value(){return normalizeQuickLinks(draft,getData().links);}
  };
}

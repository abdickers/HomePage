import {eventRows,safeWowURL} from './wow-data.js';
const $=id=>document.getElementById(id),tabs=[...document.querySelectorAll('[data-wow-edition]')];
let edition='retail',data={},error='';
try{edition=localStorage.getItem('wow-edition')==='forever'?'forever':'retail';}catch{}
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function render(){
 for(const tab of tabs)tab.setAttribute('aria-pressed',String(tab.dataset.wowEdition===edition));
 const snapshot=data[edition],forever=edition==='forever';
 $('wowEditionTitle').textContent=forever?'Today in WoW Forever':'Today in Retail';
 $('wowSource').href=forever?'https://www.wowhead.com/forever/events':'https://www.wowhead.com/today-in-wow';
 $('wowSource').textContent=forever?'Full Forever calendar ↗':'Full Today in WoW ↗';
 $('wowCharacterContext').textContent=forever?'Frear · Retail portrait shown while browsing Forever':'Frear · US Grizzly Hills · Dwarf Paladin';
 $('wowEventNote').textContent=forever?'Forever calendar dates are separate from Retail. Exact realm reset and spawn timers are not published in this source; check the in-game calendar for start times.':'US region · countdowns use published schedules and your device clock. Actual maintenance and realm availability may vary.';
 if(!snapshot){$('wowEvents').replaceChildren();$('wowFeedState').textContent=error||'Loading event schedules…';return;}
 const stamp=Date.parse(snapshot.updated),stale=!Number.isFinite(stamp)||Date.now()-stamp>3*3600000;
 $('wowFeedState').textContent=`${stale?'Schedule may be out of date · ':''}Wowhead snapshot · ${Number.isFinite(stamp)?new Date(stamp).toLocaleString([],{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}):'unknown update time'}${error?' · Refresh failed; showing saved schedule':''}`;
 const rows=eventRows(snapshot,edition);
 $('wowEvents').innerHTML=rows.length?rows.map(row=>`<a class="wow-event ${row.active?'is-active':''}" href="${escape(safeWowURL(row.url,$('wowSource').href))}" target="_blank" rel="noopener noreferrer"><span class="wow-event-label">${escape(row.label)}</span><h4>${escape(row.name)}</h4><p>${escape(row.detail)}</p><span class="wow-event-link">Details ↗</span></a>`).join(''):'<p class="wow-empty">No current schedule is available in this snapshot. Open the full calendar for the latest events.</p>';
}
async function load(){
 $('wowRefresh').disabled=true;error='';
 try{const response=await fetch('data/wow.json',{cache:'no-store'});if(!response.ok)throw Error();const next=await response.json();if(!next.retail&& !next.forever)throw Error();data=next;}
 catch{error='Event schedules are unavailable. Open the full calendar below.';}
 finally{$('wowRefresh').disabled=false;render();}
}
for(const tab of tabs)tab.addEventListener('click',()=>{edition=tab.dataset.wowEdition;try{localStorage.setItem('wow-edition',edition);}catch{}render();});
$('wowRefresh').addEventListener('click',load);
$('frearPortrait').addEventListener('error',()=>{$('frearPortrait').hidden=true;$('wowPortraitFallback').hidden=false;});
render();load();setInterval(render,30000);

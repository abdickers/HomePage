import {createGoogleConnection} from './google-connection.js?v=20261028-apps1';
import {escapeHtml as esc} from './core.js?v=20261018-bagend4';
export const rateText=value=>typeof value==='number'&&Number.isFinite(value)?value.toLocaleString(undefined,{maximumFractionDigits:2})+'%':'Not available yet';
export function initPlayApps(serviceUrl,{storage,doc=document,connection=createGoogleConnection(serviceUrl,{storage,kind:'play',lazy:true})}={}){
 const el=id=>doc.getElementById(id),state=el('playState'),list=el('playApps'),load=el('playLoad'),cohort=el('playCohort');
 let busy=false,controller,version=0,cache=new Map(),apps=[];
 const status=()=>{
  el('playConnectionStatus').textContent=connection.connected()?'Play reporting connected · data loads on request.':'Read-only reporting · connect when needed.';
  el('playDisconnect').hidden=!connection.connected();el('playConnect').textContent=connection.connected()?'Check connection':'Connect Play reporting';
  load.textContent=connection.connected()?'Refresh app list':'Connect & load apps';
 };
 function clear(){version++;controller?.abort();cache.clear();apps=[];list.replaceChildren();state.textContent='Play view cleared. Connect and load apps when needed.';status();}
 connection.subscribe(connected=>{if(!connected)clear();else status();});
 function render(report=null){
  const date=d=>d?`${d.year}-${String(d.month).padStart(2,'0')}-${String(d.day).padStart(2,'0')}`:'';
  list.innerHTML=apps.map(app=>{
   const r=report?.app===app.name?report:cache.get(cohort.value+'|'+app.name)?.report;
   return `<article class="play-app"><h3>${esc(app.displayName)}</h3><small>${esc(app.packageName)}</small>${r?`<dl class="play-metrics"><div><dt aria-label="User-perceived crashes, 7-day user-weighted rate">Crashes · 7 days</dt><dd>${rateText(r.crash?.value)}</dd>${r.crash?.date?`<small>Through ${date(r.crash.date)}</small>`:''}</div><div><dt aria-label="App not responding, 7-day user-weighted rate">Not responding · 7 days</dt><dd>${rateText(r.anr?.value)}</dd>${r.anr?.date?`<small>Through ${date(r.anr.date)}</small>`:''}</div></dl>${r.notes.map(note=>`<p>${esc(note)}</p>`).join('')}`:'<p>Vitals have not been requested.</p>'}<button type="button" data-play-app="${esc(app.name)}" ${busy?'disabled':''}>${r?'Refresh vitals':'Load vitals'}</button></article>`;
  }).join('');
 }
 async function read(app){
  if(busy)return;busy=true;const epoch=version;controller=new AbortController();load.disabled=true;cohort.disabled=true;render();
  try{
   await connection.ready();
   if(!connection.connected())await connection.connect();
   if(epoch!==version)return;
   state.textContent=app?'Reading seven days of Android vitals…':'Reading your accessible Android apps…';
   const key=cohort.value+'|'+(app||''),previous=cache.get(key);
   const result=previous&&Date.now()-previous.savedAt<60000?previous:await connection.overview({cohort:cohort.value,...(app?{app}:{})},{signal:controller.signal});
   if(epoch!==version||doc.hidden)return;
   cache.set(key,{...result,savedAt:result.savedAt||Date.now()});apps=result.apps;render(result.report);
   state.textContent=apps.length?`${apps.length} accessible ${apps.length===1?'app':'apps'} · ${cohort.selectedOptions[0].textContent} · checked ${new Date(result.updatedAt).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'})}${result.more?' · more apps are available in Play Console':''}.`:'Google returned no apps for this account. Check app permissions in Play Console.';
  }catch(error){if(epoch===version&&error.name!=='AbortError')state.textContent=error.message;}
  finally{busy=false;load.disabled=false;cohort.disabled=false;status();render();}
 }
 load.addEventListener('click',()=>void read());
 list.addEventListener('click',event=>{const button=event.target.closest('[data-play-app]');if(button)void read(button.dataset.playApp);});
 cohort.addEventListener('change',()=>{render();state.textContent='Audience changed. Load vitals for the app you want to inspect.';});
 el('playConnect').addEventListener('click',async()=>{try{await connection.ready();await connection.connect();status();}catch(error){el('playConnectionStatus').textContent=error.message;}});
 el('playDisconnect').addEventListener('click',()=>connection.disconnect());
 doc.addEventListener('visibilitychange',()=>{if(doc.hidden){version++;controller?.abort();}});
 status();return {clear};
}

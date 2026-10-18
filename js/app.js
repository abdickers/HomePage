import {initSettingsPresentation} from './settings-presentation.js?v=20261018-bagend4';
import {initWizardDisclosure} from './wizard-disclosure.js?v=20261017-gondor1';
import {initNest} from './nest.js?v=20261017-private1';
import {NEST_SERVICE_URL} from './nest-config.js?v=20261017-private1';
import {createGoogleConnection} from './google-connection.js?v=20261017-private1';
import {initBudget} from './budget.js?v=20261018-csv2';
import { initPersonalMail } from './personal-mail.js?v=20261017-polish1';
import { accountLink, PERSONAL_EMAIL } from './account-links.mjs?v=20261015-personal7';
import {DATA_KEY, escapeHtml as esc, safeUrl, safeLinkUrl, localDate, normalizeData, readData, mergeBackup, normalizeObservation} from './core.js?v=20261018-bagend4';
import {initQuickLinks, linkArtwork, linkDestination} from './quick-links-ui.js?v=20261018-bagend4';
import {internalLink} from './quick-links.js?v=20261018-bagend4';
import {initKeepNotes} from './keep-notes.js?v=20261018-bagend4';
const $ = id => document.getElementById(id);
const uid = () => crypto.randomUUID();
const settingsUI=initSettingsPresentation();
initWizardDisclosure();
let storage;
try { storage = window.localStorage; } catch { storage = {getItem:()=>null,setItem:()=>{throw new Error('Storage blocked');}}; }
let data = readData(storage);
const quickLinks=initQuickLinks({getData:()=>data,openEditor:openLinks});
const keepNotes=initKeepNotes({getData:()=>data,persist,toast});
const googleConnection=createGoogleConnection(NEST_SERVICE_URL,{storage});
const personalMail = initPersonalMail(()=>data.settings.clientId,googleConnection);
for (const a of document.querySelectorAll('a[href]')) {
 const routed=accountLink(a.href,PERSONAL_EMAIL,a.textContent.trim()); if(routed)a.href=routed;
}


let calendarDay = new Date(), lastToday = localDate();
let token = '', calendarRequest = 0;
let newsRequest = 0, weatherRequest = 0, locationRequest = 0;
let activeFeed = 'fox', undo = null, toastTimer, draftLocation;
let newsController, weatherController;
const feeds = {
  fox:{name:'Fox News',rss:'https://moxie.foxnews.com/google-publisher/latest.xml',url:'https://www.foxnews.com/'},
  wowhead:{name:'Wowhead',rss:'https://www.wowhead.com/news/rss/all',url:'https://www.wowhead.com/news'},
  tech:{name:'Hacker News',url:'https://news.ycombinator.com/'}
};
const quotes = [
  ['All we have to decide is what to do with the time that is given us.','Gandalf'],
  ['Not all those who wander are lost.','J.R.R. Tolkien'],
  ['There is some good in this world, and it is worth fighting for.','Samwise'],
  ['Deeds will not be less valiant because they are unpraised.','Aragorn']
];
function toast(message, action) {
  clearTimeout(toastTimer); undo = action || null;
  $('toastText').textContent = message; $('undoAction').hidden = !undo; $('toast').hidden = false;
  toastTimer = setTimeout(()=>{ $('toast').hidden=true; undo=null; }, action ? 15000 : 7000);
}
function persist() {
  try { storage.setItem(DATA_KEY, JSON.stringify(data)); $('storageState').textContent='Settings are saved in this browser.'; return true; }
  catch { $('storageState').textContent='Session only — browser storage is unavailable. Export a backup before closing.'; toast('Could not save in this browser. Use Settings → Export Backup.'); return false; }
}
function external(url) { const href = accountLink(url, PERSONAL_EMAIL); if (href) window.open(href,'_blank','noopener,noreferrer'); }
const icon=linkArtwork;
function renderLinks() {
  for (const [group,id] of [['ai','aiGrid'],['tools','toolGrid']]) {
    const links = data.links.filter(l=>l.group===group&&!(group==='tools'&&l.url==='https://github.com/abdickers/HomePage'));
    $(id).innerHTML = links.length ? links.map(l=>`<a class="app-card" href="${esc(linkDestination(l))}" ${internalLink(l.url)?'':'target="_blank" rel="noopener noreferrer"'}>${icon(l,'app-icon')}<span>${esc(l.name)}</span></a>`).join('') : '<p class="empty-state">Add your own links with Add Link.</p>';
  }
  quickLinks.refresh();
  keepNotes.render();
}
function updateTime() {
  const now=new Date(),today=localDate(now);
  if(today!==lastToday){if(localDate(calendarDay)===lastToday){calendarDay=now;loadCalendar();}lastToday=today;}
  $('greeting').textContent=`Good ${now.getHours()<12?'Morning':now.getHours()<17?'Afternoon':'Evening'}, ${data.settings.name}`;
  $('clockDate').textContent=now.toLocaleDateString([],{weekday:'long',month:'long',day:'numeric',year:'numeric'});
  $('clockTime').textContent=now.toLocaleTimeString([],{hour:'numeric',minute:'2-digit'});
  $('weekday').textContent=calendarDay.toLocaleDateString([],{weekday:'long'});$('daynum').textContent=calendarDay.getDate();$('monthyear').textContent=calendarDay.toLocaleDateString([],{month:'long',year:'numeric'});
}
function searchDashboard(query) {
  const q=query.toLowerCase(),matches=[];
  [...data.links,...[...document.querySelectorAll('#siteTools a')].map(a=>({name:a.querySelector('span').firstChild.textContent.trim(),url:a.href,group:'tools'}))].filter((l,i,all)=>all.findIndex(other=>other.url===l.url)===i&&`${l.name} ${l.url}`.toLowerCase().includes(q)).forEach(l=>matches.push(`<a class="search-result" href="${esc(linkDestination(l))}" ${internalLink(l.url)?'':'target="_blank" rel="noopener noreferrer"'}><small>Tool · ${esc(l.group)}</small>${esc(l.name)} <span>↗</span></a>`));
  $('searchResults').innerHTML=matches.join('')||'<p class="empty-state">No matching links found.</p>';$('searchDialog').showModal();
}
async function json(url,options={}) {
  const timeout=AbortSignal.timeout(12000),signal=options.signal?AbortSignal.any([options.signal,timeout]):timeout;
  const response=await fetch(url,{...options,signal});if(!response.ok){const error=new Error('Request failed');error.status=response.status;throw error;}return response.json();
}
async function readRss(url,signal){
  const response=await fetch(url,{signal:AbortSignal.any([signal,AbortSignal.timeout(8000)])});
  if(!response.ok)throw new Error('Feed unavailable');
  const doc=new DOMParser().parseFromString(await response.text(),'application/xml');
  if(doc.querySelector('parsererror'))throw new Error('Invalid feed');
  return [...doc.querySelectorAll('item')].slice(0,4).map(item=>({title:item.querySelector('title')?.textContent||'',link:safeUrl(item.querySelector('link')?.textContent),pubDate:item.querySelector('pubDate')?.textContent||''}));
}
function calendarState(message,tone='neutral'){$('calendarState').textContent=message;$('calendarState').dataset.tone=tone;$('calendarState').hidden=!message;}
function disconnectCalendar(endConnection=true){token='';calendarRequest++;$('calendarConnect').textContent='Refresh';$('calendarConnect').disabled=true;$('eventList').replaceChildren();calendarState('Connect personal Google in Settings for Gmail and Calendar.');if(endConnection!==false)googleConnection.disconnect();}
function restoreCalendar(){
 if(!googleConnection.connected())return;
 const changed=token!==googleConnection.sessionId();token=googleConnection.sessionId();$('calendarConnect').textContent='Refresh';$('calendarConnect').disabled=false;if(changed)void loadCalendar();
}
async function prepareCalendar() {
  $('calendarConnect').disabled=true;
  await googleConnection.ready();
  if(googleConnection.connected())restoreCalendar();else{disconnectCalendar(false);if(googleConnection.error())calendarState(googleConnection.error(),'warn');}
}
googleConnection.subscribe(connected=>{if(connected)restoreCalendar();else disconnectCalendar(false);});
async function loadCalendar() {
  if(!token||!googleConnection.connected())return;
  const request=++calendarRequest,activeToken=token;$('eventList').replaceChildren();calendarState('Loading your calendar...');
  const start=new Date(calendarDay);start.setHours(0,0,0,0);const end=new Date(start);end.setDate(end.getDate()+1);
  const params=new URLSearchParams({singleEvents:'true',orderBy:'startTime',timeMin:start.toISOString(),timeMax:end.toISOString(),maxResults:'50'});
  try{
    const result=await googleConnection.read(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(data.settings.calendarId)}/events?${params}`);
    if(request!==calendarRequest||activeToken!==token)return;const events=(result.items||[]).filter(e=>e.status!=='cancelled');calendarState(events.length?'':'No events scheduled for this day.','ok');
    $('eventList').innerHTML=events.map(e=>{const allDay=Boolean(e.start?.date),time=allDay?'All day':new Date(e.start.dateTime).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'});const minutes=allDay?0:Math.round((new Date(e.end.dateTime)-new Date(e.start.dateTime))/60000);return `<a class="event-row" href="${esc(accountLink(e.htmlLink||'https://calendar.google.com/calendar/r',PERSONAL_EMAIL))}" target="_blank" rel="noopener noreferrer"><span class="event-dot" style="--event:#e6bb62"></span><time>${esc(time)}</time><strong>${esc(e.summary||'Untitled event')}</strong><em>${minutes?minutes+'m':''}</em></a>`;}).join('');
  }catch(error){if(request!==calendarRequest)return;calendarState(error.message||'Calendar could not load. Check the calendar ID and try Refresh.','warn');}
}
function renderNews(items,feed){
  $('newsList').innerHTML=items.slice(0,4).map(item=>{const url=safeUrl(item.link);if(!url)return '';const d=new Date(item.pubDate),date=Number.isNaN(d.getTime())?'':d.toLocaleString([],{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'});return `<article class="news-item">${icon({name:feeds[feed].name,url},'news-icon')}<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(item.title)}</a><small>${esc(date||feeds[feed].name)}</small></article>`;}).join('');
}
async function loadNews(){
  const request=++newsRequest,feed=activeFeed,cfg=feeds[feed];newsController?.abort();newsController=new AbortController();
  $('viewSource').href=cfg.url;$('viewAllNews').href=cfg.url;$('newsState').textContent='Summoning ravens...';$('newsList').replaceChildren();$('refreshNews').disabled=true;
  try{
    let items,snapshotTime='';
    if(feed==='tech'){const result=await json('https://hn.algolia.com/api/v1/search?tags=front_page&hitsPerPage=4',{signal:newsController.signal});items=(result.hits||[]).map(i=>({title:i.title,link:safeUrl(i.url)||`https://news.ycombinator.com/item?id=${encodeURIComponent(i.objectID)}`,pubDate:i.created_at}));}
    else{
      try{
        if(feed==='wowhead'){
          const source=location.hostname==='inkedsage.github.io'?'https://raw.githubusercontent.com/InkedSage/Homepage/main/data/news.json':'data/news.json';
          let snapshot;
          try{snapshot=await json(source,{signal:newsController.signal,cache:'no-cache'});}
          catch{snapshot=await json('data/news.json',{signal:newsController.signal});}
          items=snapshot.feeds?.wowhead?.items;snapshotTime=snapshot.feeds?.wowhead?.updated||'';
          if(!Array.isArray(items))throw new Error('No snapshot');
        }else items=await readRss(cfg.rss,newsController.signal);
        if(!items.length)throw new Error('Empty feed');
      }
      catch{const result=await json('https://api.rss2json.com/v1/api.json?rss_url='+encodeURIComponent(cfg.rss),{signal:newsController.signal});if(result.status!=='ok')throw new Error('Feed unavailable');items=(result.items||[]).map(i=>({title:String(i.title||''),link:safeUrl(i.link),pubDate:i.pubDate?i.pubDate.replace(' ','T')+'Z':''}));}
    }
    items=items.filter(i=>i.title&&safeUrl(i.link));if(!items.length)throw new Error('Empty feed');if(request!==newsRequest)return;
    renderNews(items,feed);$('newsState').textContent=snapshotTime?cfg.name+' · feed updated '+new Date(snapshotTime).toLocaleString():'Latest from '+cfg.name;try{storage.setItem('sage_news_'+feed,JSON.stringify({items:items.slice(0,4),time:snapshotTime?Date.parse(snapshotTime):Date.now()}));}catch{}
  }catch{if(request!==newsRequest)return;let cache;try{cache=JSON.parse(storage.getItem('sage_news_'+feed));}catch{}if(Array.isArray(cache?.items)&&cache.items.length){renderNews(cache.items,feed);$('newsState').textContent='Saved headlines · '+new Date(cache.time).toLocaleString()+'. Live feed unavailable.';}else $('newsState').textContent=cfg.name+' headlines are unavailable right now. Open the source below for the latest news.';}
  finally{if(request===newsRequest)$('refreshNews').disabled=false;}
}
function displayWeather(w,source){
  const c=data.settings.unit==='celsius',fmt=(v,suffix)=>Number.isFinite(v)?Math.round(v)+suffix:'—';
  $('weatherTemp').textContent=fmt(w.temp,c?'°C':'°F');$('weatherDesc').textContent=w.description;$('weatherHumidity').textContent=fmt(w.humidity,'%');$('weatherWind').textContent=fmt(w.wind,c?' km/h':' mph');$('weatherRain').textContent=Number.isFinite(w.rain)?w.rain.toFixed(c?1:2)+(c?' mm':' in'):'—';
  const date=new Date(w.time);$('weatherUpdated').textContent=Number.isNaN(date.getTime())?'Unknown':date.toLocaleString([],{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'});$('weatherSource').textContent=source+' · '+data.settings.location.name;$('weatherLocation').textContent='Change location · '+data.settings.location.name;
  $('weatherIcon').textContent=/thunder|storm/i.test(w.description)?'ϟ':/rain|drizzle/i.test(w.description)?'☂':/snow/i.test(w.description)?'❄':/clear|sun/i.test(w.description)?'☀':'☁';
}
async function loadWeather(){
  const request=++weatherRequest,s=data.settings,l=s.location,c=s.unit==='celsius';weatherController?.abort();weatherController=new AbortController();const signal=weatherController.signal;
  $('refreshWeather').disabled=true;$('weatherSource').textContent='Checking weather for '+l.name+'...';let weather,source;
  try{
    try{
      const point=await json(`https://api.weather.gov/points/${l.lat.toFixed(4)},${l.lon.toFixed(4)}`,{signal});const stations=await json(point.properties.observationStations,{signal});const station=stations.features?.[0]?.properties?.stationIdentifier;if(!station)throw new Error('No station');
      const obs=await json(`https://api.weather.gov/stations/${encodeURIComponent(station)}/observations/latest`,{signal});weather=normalizeObservation(obs.properties,s.unit);if(weather.temp===null||!Number.isFinite(Date.parse(weather.time))||Date.now()-Date.parse(weather.time)>3*3600000)throw new Error('Observation unavailable');source='NWS / '+station;
    }catch{
      if(signal.aborted)return;
      const params=new URLSearchParams({latitude:l.lat,longitude:l.lon,current:'temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m',temperature_unit:s.unit,wind_speed_unit:c?'kmh':'mph',timezone:'UTC'});
      const result=await json('https://api.open-meteo.com/v1/forecast?'+params,{signal});const v=result.current;if(typeof v?.temperature_2m!=='number')throw new Error('No weather');const code=v.weather_code,description=code===0?'Clear skies':code<=3?'Partly cloudy':code<=48?'Fog':code<=67?'Rain':code<=77?'Snow':code<=82?'Rain showers':code<=86?'Snow showers':'Thunderstorms';
      weather={temp:v.temperature_2m,humidity:v.relative_humidity_2m,wind:v.wind_speed_10m,rain:null,description,time:v.time+'Z'};source='Open-Meteo forecast';
    }
    if(request!==weatherRequest)return;displayWeather(weather,source);
  }catch{if(request!==weatherRequest)return;displayWeather({description:'Weather unavailable'},'Weather services unavailable');$('weatherSource').textContent='Could not load weather for '+l.name+'. Try Refresh.';}
  finally{if(request===weatherRequest)$('refreshWeather').disabled=false;}
}
function openSettings(section='connections'){const s=data.settings;draftLocation={...s.location};quickLinks.begin();$('settingName').value=s.name;$('settingUnit').value=s.unit;$('settingClientId').value=s.clientId;$('settingCalendarId').value=s.calendarId;$('oauthOrigin').textContent=location.origin;$('selectedLocation').textContent='Selected: '+s.location.name;$('locationQuery').value='';$('locationResults').replaceChildren();settingsUI.select(section);$('settingsDialog').showModal();settingsUI.select(section,{focus:true});}
function openLinks(){$('linkForm').reset();$('linkId').value='';$('linkError').textContent='';renderLinkManager();$('linkDialog').showModal();}
function renderLinkManager(){$('manageLinks').innerHTML=data.links.map(l=>`<div><span>${esc(l.name)} <small>${esc(l.group)}</small></span><button type="button" data-edit-link="${esc(l.id)}" aria-label="Edit ${esc(l.name)}">Edit</button><button type="button" data-delete-link="${esc(l.id)}" aria-label="Delete link ${esc(l.name)}">×</button></div>`).join('');}
$('searchForm').addEventListener('submit',e=>{e.preventDefault();const q=$('searchInput').value.trim();if(q)$('searchScope').value==='dashboard'?searchDashboard(q):external('https://www.google.com/search?q='+encodeURIComponent(q));});
$('askAi').addEventListener('click',()=>{const q=$('searchInput').value.trim();external(q?'https://chatgpt.com/?q='+encodeURIComponent(q):'https://chatgpt.com/');});
$('themeToggle')?.addEventListener('click',()=>{const ember=document.body.classList.toggle('ember-mode');$('themeToggle').setAttribute('aria-pressed',ember);try{storage.setItem('sage_theme',ember?'ember':'night');}catch{toast('Theme changed for this session.');}});
for(const id of ['settingsOpen','footerSettings','weatherLocation'])$(id).addEventListener('click',()=>openSettings(id==='weatherLocation'?'preferences':'connections'));
$('calendarConnect').addEventListener('click',()=>{if(googleConnection.connected())return token?loadCalendar():restoreCalendar();});
for(const [id,offset] of [['calendarPrev',-1],['calendarNext',1],['calendarToday',0]])$(id).addEventListener('click',()=>{if(offset)calendarDay.setDate(calendarDay.getDate()+offset);else calendarDay=new Date();updateTime();loadCalendar();});
$('newsTabs').addEventListener('click',e=>{const b=e.target.closest('[data-feed]');if(!b)return;activeFeed=b.dataset.feed;document.querySelectorAll('[data-feed]').forEach(t=>{t.classList.toggle('active',t===b);t.setAttribute('aria-pressed',t===b);});loadNews();});
$('refreshNews').addEventListener('click',loadNews);$('refreshWeather').addEventListener('click',loadWeather);
$('settingsForm').addEventListener('submit',e=>{e.preventDefault();const old=data.settings;data.settings=normalizeData({links:data.links,settings:{...old,name:$('settingName').value,unit:$('settingUnit').value,clientId:$('settingClientId').value,calendarId:$('settingCalendarId').value,location:draftLocation,quickLinks:quickLinks.value()}}).settings;const saved=persist();quickLinks.renderHeader();$('settingsDialog').close();updateTime();loadWeather();if(old.clientId!==data.settings.clientId||old.calendarId!==data.settings.calendarId){personalMail.disconnect(false);disconnectCalendar(false);prepareCalendar();}if(saved)toast('Settings saved.');});
$('findLocation').addEventListener('click',async()=>{
  const q=$('locationQuery').value.trim();if(!q)return;const request=++locationRequest;$('locationResults').textContent='Finding your city...';
  try{const result=await json('https://geocoding-api.open-meteo.com/v1/search?count=5&language=en&format=json&name='+encodeURIComponent(q));if(request!==locationRequest)return;const locations=(result.results||[]).map(l=>({name:[l.name,l.admin1,l.country_code].filter(Boolean).join(', '),lat:l.latitude,lon:l.longitude}));$('locationResults').replaceChildren();if(!locations.length)$('locationResults').textContent='No cities found. Try a nearby city name.';for(const l of locations){const button=document.createElement('button');button.type='button';button.textContent=l.name;button.addEventListener('click',()=>{draftLocation=l;$('selectedLocation').textContent='Selected: '+l.name;$('locationResults').replaceChildren();});$('locationResults').append(button);}}
  catch{if(request===locationRequest)$('locationResults').textContent='Location search is unavailable. Your saved location is unchanged.';}
});
$('locationQuery').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();$('findLocation').click();}});
$('addLink').addEventListener('click',openLinks);
$('linkForm').addEventListener('submit',e=>{e.preventDefault();const url=safeLinkUrl($('linkUrl').value),name=$('linkName').value.trim();if(!url||!name){$('linkError').textContent='Use a name and a valid http:// or https:// address, or a dashboard section such as #homePanel.';$('linkUrl').setAttribute('aria-invalid','true');return;}const link={id:$('linkId').value||uid(),name,url,group:$('linkGroup').value,icon:$('linkIcon').value},i=data.links.findIndex(l=>l.id===link.id);if(i<0)data.links.push(link);else data.links[i]=link;data=normalizeData(data);persist();renderLinks();renderLinkManager();$('linkForm').reset();$('linkId').value='';$('linkError').textContent='';$('linkUrl').removeAttribute('aria-invalid');toast('Link saved.');});
$('manageLinks').addEventListener('click',e=>{const edit=e.target.closest('[data-edit-link]'),del=e.target.closest('[data-delete-link]');const l=data.links.find(l=>l.id===(edit?.dataset.editLink||del?.dataset.deleteLink));if(!l)return;if(edit){$('linkId').value=l.id;$('linkName').value=l.name;$('linkUrl').value=l.url;$('linkGroup').value=l.group;$('linkIcon').value=l.icon||'auto';$('linkName').focus();}else{const previous=data.settings.quickLinks;data.links=data.links.filter(v=>v!==l);data=normalizeData(data);persist();renderLinks();renderLinkManager();toast('Link removed.',()=>{data.links.push(l);data.settings.quickLinks=previous;data=normalizeData(data);persist();renderLinks();renderLinkManager();});}});
$('exportData').addEventListener('click',()=>{const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='sage-command-'+localDate()+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);});
$('importData').addEventListener('change',async e=>{const file=e.target.files[0];if(!file)return;try{if(file.size>5*1024*1024)throw new Error('Backup is too large (maximum 5 MB).');const before=structuredClone(data),incoming=JSON.parse(await file.text());data=mergeBackup(data,incoming);persist();renderLinks();personalMail.disconnect(false);disconnectCalendar(false);prepareCalendar();updateTime();loadWeather();$('settingsDialog').close();toast('Backup restored.',()=>{data=before;persist();renderLinks();personalMail.disconnect(false);disconnectCalendar(false);prepareCalendar();updateTime();loadWeather();});}catch(error){toast(error instanceof SyntaxError?'This file is not valid JSON.':error.message);}e.target.value='';});
$('undoAction').addEventListener('click',()=>{const action=undo;undo=null;$('toast').hidden=true;action?.();});$('dismissToast').addEventListener('click',()=>{$('toast').hidden=true;undo=null;});
document.querySelectorAll('[data-close]').forEach(button=>button.addEventListener('click',()=>button.closest('dialog').close()));
document.querySelectorAll('dialog').forEach(dialog=>dialog.addEventListener('click',e=>{if(e.target!==dialog)return;const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();}));
document.addEventListener('error',e=>{if(e.target instanceof HTMLImageElement){e.target.hidden=true;const fallback=e.target.nextElementSibling;if(fallback?.classList.contains('icon-fallback'))fallback.hidden=false;}},true);
document.addEventListener('keydown',e=>{if(e.key==='/'&&!document.querySelector('dialog[open]')&&!['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName)){e.preventDefault();$('searchInput').focus();}});
window.addEventListener('storage',e=>{if(e.key===DATA_KEY){const old=data.settings;data=readData(storage);renderLinks();updateTime();if(JSON.stringify(old)!==JSON.stringify(data.settings)){if(old.clientId!==data.settings.clientId)personalMail.disconnect(false);disconnectCalendar(false);prepareCalendar();loadWeather();}}});
window.addEventListener('online',()=>{loadWeather();loadNews();});
try{if(storage.getItem('sage_theme')==='ember')document.body.classList.add('ember-mode');}catch{}
$('themeToggle')?.setAttribute('aria-pressed',document.body.classList.contains('ember-mode'));
document.querySelectorAll('a[target="_blank"]').forEach(a=>a.rel='noopener noreferrer');
renderLinks();updateTime();persist();
const quote=quotes[Math.floor(Date.now()/86400000)%quotes.length];$('quoteText').textContent='“'+quote[0]+'”';$('quoteBy').textContent=quote[1];
prepareCalendar();loadNews();loadWeather();
setInterval(updateTime,30000);setInterval(loadWeather,10*60*1000);setInterval(loadNews,15*60*1000);

initNest(NEST_SERVICE_URL);
initBudget({connection:googleConnection,serviceUrl:NEST_SERVICE_URL});

import {initNest} from './nest.js?v=20261015-remember1';
import {NEST_SERVICE_URL} from './nest-config.js?v=20261015-personal7';
import {initMedia} from './media.js?v=20261015-personal7';
import {createGoogleConnection} from './google-connection.js?v=20261015-remember1';
import { initPersonalMail } from './personal-mail.js?v=20261015-remember1';
import { accountLink, PERSONAL_EMAIL } from './account-links.mjs?v=20261015-personal7';
import {DATA_KEY, escapeHtml as esc, safeUrl, localDate, normalizeData, readData, mergeBackup, normalizeObservation} from './core.js?v=20261015-personal7';
const $ = id => document.getElementById(id);
const uid = () => crypto.randomUUID();
let storage;
try { storage = window.localStorage; } catch { storage = {getItem:()=>null,setItem:()=>{throw new Error('Storage blocked');}}; }
let data = readData(storage);
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
const services = [
  {name:'NetSuite',url:'https://status.netsuite.com/'},
  {name:'BigCommerce',url:'https://status.bigcommerce.com/',api:'https://status.bigcommerce.com/api/v2/summary.json'},
  {name:'Vercel',url:'https://www.vercel-status.com/',api:'https://www.vercel-status.com/api/v2/summary.json'},
  {name:'Slack',url:'https://slack-status.com/',api:'https://slack-status.com/api/v2.0.0/current'},
  {name:'OpenAI',url:'https://status.openai.com/',api:'https://status.openai.com/api/v2/summary.json'},
  {name:'Cloudflare',url:'https://www.cloudflarestatus.com/',api:'https://www.cloudflarestatus.com/api/v2/summary.json'}
];
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
  try { storage.setItem(DATA_KEY, JSON.stringify(data)); $('storageState').textContent='Notes and settings are saved in this browser.'; return true; }
  catch { $('storageState').textContent='Session only — browser storage is unavailable. Export a backup before closing.'; toast('Could not save in this browser. Use Settings → Export Backup.'); return false; }
}
function external(url) { const href = accountLink(url, PERSONAL_EMAIL); if (href) window.open(href,'_blank','noopener,noreferrer'); }
function icon(link, kind) {
  const host = new URL(link.url).hostname;
  const known={'ChatGPT':'chatgpt.svg','Claude':'claude.svg','Gemini':'gemini.svg','NetSuite':'netsuite.svg','Slack':'slack.svg','BigCommerce':'bigcommerce.svg','Vercel':'vercel.svg','Jira':'jira.svg','Confluence':'confluence.svg','Dotdigital':'dotdigital.png','Zoom':'zoom.svg','GitHub':'github.svg','Cloudflare':'cloudflare.svg','Gmail':'gmail.png','Google Calendar':'calendar.png','My Drive':'drive.png'};
  const source=known[link.name]?'assets/logos/'+known[link.name]:'https://www.google.com/s2/favicons?domain='+encodeURIComponent(host)+'&sz=64';
  return `<span class="${kind}"><img src="${esc(source)}" alt="" loading="lazy" /><span class="icon-fallback" hidden>${esc(link.name.slice(0,2).toUpperCase())}</span></span>`;
}
function renderLinks() {
  for (const [group,id] of [['ai','aiGrid'],['tools','toolGrid'],['quick','quickList']]) {
    const links = data.links.filter(l=>l.group===group);
    $(id).innerHTML = links.length ? links.map(l=>group==='quick'
      ? `<a class="quick-item" href="${esc(accountLink(l.url, PERSONAL_EMAIL, l.name))}" target="_blank" rel="noopener noreferrer">${icon(l,'quick-icon')}<b>${esc(l.name)}</b><span class="chevron" aria-hidden="true">›</span></a>`
      : `<a class="app-card" href="${esc(accountLink(l.url, PERSONAL_EMAIL, l.name))}" target="_blank" rel="noopener noreferrer">${icon(l,'app-icon')}<span>${esc(l.name)}</span></a>`).join('') : '<p class="empty-state">Add your own links with Add Link.</p>';
  }
}
function renderNotes() {
  $('noteGrid').innerHTML=data.notes.length?data.notes.map(n=>`<button class="note" type="button" data-note-id="${esc(n.id)}" aria-label="Edit note: ${esc(n.title)}"><h3>${esc(n.title)}</h3><p>${esc(n.text)}</p><small>Edit note ↗</small></button>`).join(''):'<button class="note empty-note" type="button" data-new-note><h3>Make room for an idea.</h3><p>Write your first note. It will be here when you return.</p><small>+ New Note</small></button>';
}
function openNote(id) {
  const n=data.notes.find(n=>n.id===id);$('noteId').value=n?.id||'';$('noteName').value=n?.title||'';$('noteText').value=n?.text||'';$('deleteNote').hidden=!n;$('noteDialog').showModal();
}
function renderFellowship() {
  const members=[['Frodo','11-row3-col3'],['Gandalf','06-row2-col2'],['Aragorn','10-row3-col2'],['Legolas','09-row3-col1'],['Gimli','07-row2-col3'],['Samwise','12-row3-col4'],['Merry & Pippin','13-row4-col4']];
  $('fellowshipList').innerHTML=members.map(([name,img])=>`<figure class="fellowship-member"><img src="assets/avatars/avatar-${img}.png" alt="${esc(name)}" loading="lazy" /><figcaption>${esc(name)}</figcaption></figure>`).join('');
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
  data.links.filter(l=>`${l.name} ${l.url}`.toLowerCase().includes(q)).forEach(l=>matches.push(`<a class="search-result" href="${esc(accountLink(l.url, PERSONAL_EMAIL, l.name))}" target="_blank" rel="noopener noreferrer"><small>Tool · ${esc(l.group)}</small>${esc(l.name)} <span>↗</span></a>`));
  data.notes.filter(n=>`${n.title} ${n.text}`.toLowerCase().includes(q)).forEach(n=>matches.push(`<button class="search-result" data-find-note="${esc(n.id)}" type="button"><small>Note</small>${esc(n.title)}</button>`));
  $('searchResults').innerHTML=matches.join('')||'<p class="empty-state">No matches in your tools or notes.</p>';$('searchDialog').showModal();
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
function disconnectCalendar(endConnection=true){token='';calendarRequest++;$('calendarConnect').textContent='Connect personal Google';$('calendarConnect').disabled=false;$('calendarDisconnect').hidden=true;$('eventList').replaceChildren();calendarState('Connect personal Google once for Gmail and Calendar. This browser will remember your sign-in.');if(endConnection!==false)googleConnection.disconnect();}
function restoreCalendar(){
 if(!googleConnection.connected())return;
 const changed=token!==googleConnection.sessionId();token=googleConnection.sessionId();$('calendarConnect').textContent='Refresh';$('calendarConnect').disabled=false;$('calendarDisconnect').hidden=false;if(changed)void loadCalendar();
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
async function loadStatuses(){
  const rows=await Promise.all(services.map(async service=>{
    if(!service.api)return {...service,state:'View status',tone:'unknown',incidents:[]};
    try{const result=await json(service.api);if(service.name==='Slack'){if(!['ok','active'].includes(result.status))throw new Error('Invalid status');return {...service,state:result.status==='ok'?'Operational':'Incident reported',tone:result.status==='ok'?'good':'warn',incidents:result.active_incidents||[]};}
      if(!result.status||!['none','minor','major','critical','maintenance'].includes(result.status.indicator))throw new Error('Invalid status');return {...service,state:result.status.description||'View status',tone:result.status.indicator==='none'?'good':'warn',incidents:(result.incidents||[]).filter(i=>!['resolved','postmortem'].includes(i.status))};
    }catch{return {...service,state:'View status',tone:'unknown',incidents:[]};}
  }));
  $('statusList').innerHTML=rows.map(s=>`<a class="status-row" href="${s.url}" target="_blank" rel="noopener noreferrer"><span class="status-dot ${s.tone}"></span><span>${esc(s.name)}</span><b class="${s.tone}">${esc(s.state)} ↗</b></a>`).join('');
  const incidents=rows.flatMap(s=>s.incidents.map(i=>({service:s.name,name:i.name||i.title||'Incident reported',url:safeUrl(i.shortlink||i.url)||s.url}))),unknown=rows.filter(s=>s.tone==='unknown').length;
  $('incidentText').innerHTML=incidents.length?incidents.slice(0,4).map(i=>`<p><a href="${esc(i.url)}" target="_blank" rel="noopener noreferrer">${esc(i.service)}: ${esc(i.name)} ↗</a></p>`).join(''):'<p>No open incidents reported by the connected feeds.</p>';
  $('incidentText').insertAdjacentHTML('beforeend',`<small>Checked ${new Date().toLocaleTimeString([],{hour:'numeric',minute:'2-digit'})}.${unknown?' '+unknown+' services need a check on their status page.':''}</small>`);
}
function openSettings(){const s=data.settings;draftLocation={...s.location};$('settingName').value=s.name;$('settingUnit').value=s.unit;$('settingClientId').value=s.clientId;$('settingCalendarId').value=s.calendarId;$('oauthOrigin').textContent=location.origin;$('selectedLocation').textContent='Selected: '+s.location.name;$('locationQuery').value='';$('locationResults').replaceChildren();$('settingsDialog').showModal();}
function openLinks(){$('linkForm').reset();$('linkId').value='';$('linkError').textContent='';renderLinkManager();$('linkDialog').showModal();}
function renderLinkManager(){$('manageLinks').innerHTML=data.links.map(l=>`<div><span>${esc(l.name)} <small>${esc(l.group)}</small></span><button type="button" data-edit-link="${esc(l.id)}" aria-label="Edit ${esc(l.name)}">Edit</button><button type="button" data-delete-link="${esc(l.id)}" aria-label="Delete link ${esc(l.name)}">×</button></div>`).join('');}
$('searchForm').addEventListener('submit',e=>{e.preventDefault();const q=$('searchInput').value.trim();if(q)$('searchScope').value==='dashboard'?searchDashboard(q):external('https://www.google.com/search?q='+encodeURIComponent(q));});
$('askAi').addEventListener('click',()=>{const q=$('searchInput').value.trim();external(q?'https://chatgpt.com/?q='+encodeURIComponent(q):'https://chatgpt.com/');});
$('addNote').addEventListener('click',()=>openNote());
$('noteGrid').addEventListener('click',e=>{const n=e.target.closest('[data-note-id],[data-new-note]');if(n)openNote(n.dataset.noteId);});
$('noteForm').addEventListener('submit',e=>{e.preventDefault();const n={id:$('noteId').value||uid(),title:$('noteName').value.trim(),text:$('noteText').value.trim()};if(!n.title||!n.text)return;const index=data.notes.findIndex(v=>v.id===n.id);if(index<0)data.notes.push(n);else data.notes[index]=n;persist();renderNotes();$('noteDialog').close();});
$('deleteNote').addEventListener('click',()=>{const n=data.notes.find(n=>n.id===$('noteId').value);data.notes=data.notes.filter(v=>v!==n);persist();renderNotes();$('noteDialog').close();toast('Note removed.',()=>{data.notes.push(n);persist();renderNotes();});});
$('themeToggle').addEventListener('click',()=>{const ember=document.body.classList.toggle('ember-mode');$('themeToggle').setAttribute('aria-pressed',ember);try{storage.setItem('sage_theme',ember?'ember':'night');}catch{toast('Theme changed for this session.');}});
for(const id of ['settingsOpen','footerSettings','weatherLocation'])$(id).addEventListener('click',openSettings);
$('calendarConnect').addEventListener('click',()=>{if(googleConnection.connected())return token?loadCalendar():restoreCalendar();calendarState('Choose '+PERSONAL_EMAIL+' and grant read-only Gmail and Calendar access.');void googleConnection.connect().catch(error=>calendarState(error.message,'warn'));});
$('calendarDisconnect').addEventListener('click',()=>disconnectCalendar());
for(const [id,offset] of [['calendarPrev',-1],['calendarNext',1],['calendarToday',0]])$(id).addEventListener('click',()=>{if(offset)calendarDay.setDate(calendarDay.getDate()+offset);else calendarDay=new Date();updateTime();loadCalendar();});
$('newsTabs').addEventListener('click',e=>{const b=e.target.closest('[data-feed]');if(!b)return;activeFeed=b.dataset.feed;document.querySelectorAll('[data-feed]').forEach(t=>{t.classList.toggle('active',t===b);t.setAttribute('aria-pressed',t===b);});loadNews();});
$('refreshNews').addEventListener('click',loadNews);$('refreshWeather').addEventListener('click',loadWeather);
$('settingsForm').addEventListener('submit',e=>{e.preventDefault();const old=data.settings;data.settings=normalizeData({settings:{name:$('settingName').value,unit:$('settingUnit').value,clientId:$('settingClientId').value,calendarId:$('settingCalendarId').value,location:draftLocation}}).settings;const saved=persist();$('settingsDialog').close();updateTime();loadWeather();if(old.clientId!==data.settings.clientId||old.calendarId!==data.settings.calendarId){personalMail.disconnect(false);disconnectCalendar(false);prepareCalendar();}if(saved)toast('Settings saved.');});
$('findLocation').addEventListener('click',async()=>{
  const q=$('locationQuery').value.trim();if(!q)return;const request=++locationRequest;$('locationResults').textContent='Finding your city...';
  try{const result=await json('https://geocoding-api.open-meteo.com/v1/search?count=5&language=en&format=json&name='+encodeURIComponent(q));if(request!==locationRequest)return;const locations=(result.results||[]).map(l=>({name:[l.name,l.admin1,l.country_code].filter(Boolean).join(', '),lat:l.latitude,lon:l.longitude}));$('locationResults').replaceChildren();if(!locations.length)$('locationResults').textContent='No cities found. Try a nearby city name.';for(const l of locations){const button=document.createElement('button');button.type='button';button.textContent=l.name;button.addEventListener('click',()=>{draftLocation=l;$('selectedLocation').textContent='Selected: '+l.name;$('locationResults').replaceChildren();});$('locationResults').append(button);}}
  catch{if(request===locationRequest)$('locationResults').textContent='Location search is unavailable. Your saved location is unchanged.';}
});
$('locationQuery').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();$('findLocation').click();}});
$('addLink').addEventListener('click',openLinks);
$('linkForm').addEventListener('submit',e=>{e.preventDefault();const url=safeUrl($('linkUrl').value),name=$('linkName').value.trim();if(!url||!name){$('linkError').textContent='Use a name and a full http:// or https:// address.';return;}const link={id:$('linkId').value||uid(),name,url,group:$('linkGroup').value},i=data.links.findIndex(l=>l.id===link.id);if(i<0)data.links.push(link);else data.links[i]=link;persist();renderLinks();renderLinkManager();$('linkForm').reset();$('linkId').value='';$('linkError').textContent='';toast('Link saved.');});
$('manageLinks').addEventListener('click',e=>{const edit=e.target.closest('[data-edit-link]'),del=e.target.closest('[data-delete-link]');const l=data.links.find(l=>l.id===(edit?.dataset.editLink||del?.dataset.deleteLink));if(!l)return;if(edit){$('linkId').value=l.id;$('linkName').value=l.name;$('linkUrl').value=l.url;$('linkGroup').value=l.group;$('linkName').focus();}else{data.links=data.links.filter(v=>v!==l);persist();renderLinks();renderLinkManager();toast('Link removed.',()=>{data.links.push(l);persist();renderLinks();renderLinkManager();});}});
$('searchResults').addEventListener('click',e=>{const note=e.target.closest('[data-find-note]');if(note){$('searchDialog').close();openNote(note.dataset.findNote);}});
$('exportData').addEventListener('click',()=>{const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='sage-command-'+localDate()+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);});
$('importData').addEventListener('change',async e=>{const file=e.target.files[0];if(!file)return;try{if(file.size>5*1024*1024)throw new Error('Backup is too large (maximum 5 MB).');const before=structuredClone(data),incoming=JSON.parse(await file.text());data=mergeBackup(data,incoming);persist();renderLinks();renderNotes();personalMail.disconnect(false);disconnectCalendar(false);prepareCalendar();updateTime();loadWeather();$('settingsDialog').close();toast('Backup restored.',()=>{data=before;persist();renderLinks();renderNotes();personalMail.disconnect(false);disconnectCalendar(false);prepareCalendar();updateTime();loadWeather();});}catch(error){toast(error instanceof SyntaxError?'This file is not valid JSON.':error.message);}e.target.value='';});
$('undoAction').addEventListener('click',()=>{const action=undo;undo=null;$('toast').hidden=true;action?.();});$('dismissToast').addEventListener('click',()=>{$('toast').hidden=true;undo=null;});
document.querySelectorAll('[data-close]').forEach(button=>button.addEventListener('click',()=>button.closest('dialog').close()));
document.querySelectorAll('dialog').forEach(dialog=>dialog.addEventListener('click',e=>{if(e.target!==dialog)return;const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();}));
document.addEventListener('error',e=>{if(e.target instanceof HTMLImageElement){e.target.hidden=true;const fallback=e.target.nextElementSibling;if(fallback?.classList.contains('icon-fallback'))fallback.hidden=false;}},true);
document.addEventListener('keydown',e=>{if(e.key==='/'&&!document.querySelector('dialog[open]')&&!['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName)){e.preventDefault();$('searchInput').focus();}});
window.addEventListener('storage',e=>{if(e.key===DATA_KEY){const old=data.settings;data=readData(storage);renderLinks();renderNotes();updateTime();if(JSON.stringify(old)!==JSON.stringify(data.settings)){if(old.clientId!==data.settings.clientId)personalMail.disconnect(false);disconnectCalendar(false);prepareCalendar();loadWeather();}}});
window.addEventListener('online',()=>{loadWeather();loadNews();loadStatuses();});
try{if(storage.getItem('sage_theme')==='ember')document.body.classList.add('ember-mode');}catch{}
$('themeToggle').setAttribute('aria-pressed',document.body.classList.contains('ember-mode'));
document.querySelectorAll('a[target="_blank"]').forEach(a=>a.rel='noopener noreferrer');
renderLinks();renderNotes();renderFellowship();updateTime();persist();
const quote=quotes[Math.floor(Date.now()/86400000)%quotes.length];$('quoteText').textContent='“'+quote[0]+'”';$('quoteBy').textContent=quote[1];
prepareCalendar();loadNews();loadWeather();loadStatuses();
setInterval(updateTime,30000);setInterval(loadWeather,10*60*1000);setInterval(loadStatuses,5*60*1000);setInterval(loadNews,15*60*1000);

initMedia(storage);

initNest(NEST_SERVICE_URL);

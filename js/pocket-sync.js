/* Explicit browser-to-phone handoff. No fetches, credentials, timers, or background work. */
export function snapshotCards(doc,realm){
 const clean=(s,max=640)=>String(s||'').replace(/\s+/g,' ').trim().slice(0,max);
 const text=selector=>clean(doc.querySelector(selector)?.textContent);
 const list=(selector,max=3)=>[...doc.querySelectorAll(selector)].slice(0,max).map(node=>clean(node.textContent,180)).filter(Boolean).join('\n');
 const cards=[];const add=(key,title,body)=>{if(body)cards.push({key,title,body});};
 if(realm==='personal'){
  add('weather','Weather at Sage Cabin',[text('#weatherTemp'),text('#weatherDesc'),'Humidity '+text('#weatherHumidity'),'Wind '+text('#weatherWind'),text('#weatherSource'),text('#weatherUpdated')].filter(Boolean).join('\n'));
  add('calendar','Today’s calendar',list('#eventList .event-row')||text('#calendarState'));
  add('hearth','The hearth',[text('#nestTemperature')+' '+text('#nestTemperatureUnit'),text('#nestConfirmedMode'),text('#nestActivity'),text('#nestLastChecked')].filter(Boolean).join('\n'));
  add('mail','The Ravens',list('#ravensList .daily-item strong')||list('#ravensList a strong')||text('#ravensState'));
  add('apps','Android apps',list('#playApps .play-app-card h3')||text('#playState'));
 }else if(realm==='work'){
  add('projects','Beacons · selected project view',list('.operations .citadel-project-card',2)||list('.operations .realm-beacons',1)||text('.operations .feed-error')||text('.operations .operations-empty'));
  add('calendar','Today’s council',list('.agenda .event')||text('.agenda .agenda-empty'));
  add('mail','The Ravens',list('.daily-panel.ravens .daily-entry strong')||text('.daily-panel.ravens .daily-error')||text('.daily-panel.ravens .daily-empty'));
  add('quests','Active quests',list('.daily-panel.quests .daily-entry strong')||text('.daily-panel.quests .daily-error')||text('.daily-panel.quests .daily-empty'));
  add('priorities','Your priorities',list('.priorities .task > span'));
 }
 return cards.slice(0,6).map(card=>({...card,body:clean(card.body)}));
}

const host=globalThis.location?.hostname;
const realm=host==='sage-cabin-nest.nest-service.workers.dev'?'personal':host==='adams-middle-earth-command.spirit-of-76-1921.chatgpt.site'?'work':null;
const nonce=new URLSearchParams(globalThis.location?.search||'').get('pocket-sync');
if(realm&&/^[a-f0-9]{64}$/.test(nonce||'')){
 const panel=document.createElement('aside');panel.setAttribute('aria-label','Sync Pocket Command');
 Object.assign(panel.style,{position:'fixed',zIndex:'2147483646',bottom:'12px',left:'12px',right:'12px',maxWidth:'520px',margin:'0 auto',padding:'16px',background:'#13243c',color:'#f4ecdc',border:'1px solid #d8c695',borderRadius:'16px',boxShadow:'0 8px 30px #0008',font:'14px/1.5 system-ui'});
 const title=document.createElement('strong');title.textContent='Save this dashboard to your phone';panel.append(title);
 const explanation=document.createElement('p');explanation.textContent='Wait for your information to load, then save. Only the visible summary is copied to Pocket Command. No banking, Warcraft, passwords, or sign-in tokens.';explanation.style.margin='8px 0';panel.append(explanation);
 const save=document.createElement('button');save.type='button';save.textContent='Save to phone';Object.assign(save.style,{minHeight:'48px',padding:'10px 20px',color:'#f4ecdc',background:'#263c58',border:'1px solid #d8c695',borderRadius:'10px',marginRight:'8px'});
 save.addEventListener('click',()=>{
  const cards=snapshotCards(document,realm);
  if(!cards.length){explanation.textContent='No supported information has loaded yet. Sign in and open a project view, then try again.';return;}
  const payload={version:1,realm,capturedAt:Date.now(),cards};
  const data=btoa(String.fromCharCode(...new TextEncoder().encode(JSON.stringify(payload)))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
  // Explicit package prevents another app from intercepting the intent.
  location.href=`intent://snapshot?realm=${realm}&nonce=${nonce}&data=${data}#Intent;scheme=com.abdickers.pocket;package=com.abdickers.pocket;end`;
 });panel.append(save);
 const dismiss=document.createElement('button');dismiss.textContent='Cancel';dismiss.type='button';Object.assign(dismiss.style,{minHeight:'48px',padding:'10px 16px',borderRadius:'10px'});dismiss.addEventListener('click',()=>{panel.remove();const url=new URL(location.href);url.searchParams.delete('pocket-sync');history.replaceState(null,'',url);});panel.append(dismiss);
 document.body.append(panel);
}

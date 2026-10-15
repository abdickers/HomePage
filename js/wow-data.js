export function safeWowURL(value, fallback='https://www.wowhead.com/today-in-wow') {
 try { const url=new URL(value,'https://www.wowhead.com');return url.protocol==='https:'&&url.hostname==='www.wowhead.com'?url.href:fallback; }catch{return fallback;}
}
export function duration(seconds){
 const minutes=Math.max(1,Math.ceil(seconds/60)),days=Math.floor(minutes/1440),hours=Math.floor(minutes%1440/60),mins=minutes%60;
 return [days?`${days}d`:'',hours?`${hours}h`:'',mins?`${mins}m`:''].filter(Boolean).join(' ');
}
export function eventRows(snapshot, edition, now=Date.now()) {
 const fresh=Number.isFinite(Date.parse(snapshot.updated))&&now-Date.parse(snapshot.updated)<3*3600000;
 if(edition==='forever'){
  const today=new Date(now).toLocaleDateString('en-CA',{timeZone:'America/Chicago'});
  return (snapshot.events||[]).filter(e=>e.endDate>=today).map(e=>({...e,label:e.startDate<=today?'On the calendar':'Upcoming',detail:`${e.startDate} → ${e.endDate} · calendar dates`,active:e.startDate<=today})).slice(0,12);
 }
 const rows=[];
 for(const group of snapshot.groups||[]){
  let lines=(group.content?.lines||[]).filter(l=>l&&!Array.isArray(l));
  if(group.timing?.intervalSecs>0&&fresh){
   const t=group.timing,seconds=now/1000,start=t.anchor+Math.floor((seconds-t.anchor)/t.intervalSecs)*t.intervalSecs,end=start+t.durationSecs;
   rows.push({name:group.name,url:group.url,label:seconds<end?'Active now':'Next up',detail:seconds<end?`Ends in ${duration(end-seconds)}`:`Starts in ${duration(start+t.intervalSecs-seconds)}`,active:seconds<end});
   continue;
  }
  const timed=lines.some(l=>l.startingUt||l.endingUt);
  if(timed){
   lines=lines.filter(l=>Number(l.endingUt)>now/1000).slice(0,2);
   for(const l of lines){
    const active=!!l.startingUt&&l.startingUt<=now/1000;
    rows.push({name:l.name?`${group.name} · ${l.name}`:group.name,url:l.url||group.url,label:active?'Active now':l.startingUt?'Upcoming':'Reset',detail:l.startingUt&&!active?`Starts in ${duration(l.startingUt-now/1000)}`:`${active?'Ends':'Resets'} in ${duration(l.endingUt-now/1000)}`,active});
   }
  }else if(lines.length){
   rows.push({name:group.name,url:group.url||lines[0].url,label:fresh?'Current snapshot':'Last known',detail:lines.map(l=>l.name).filter(Boolean).join(' · '),active:false});
  }
 }
 return rows;
}

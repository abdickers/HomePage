import {validDate,today} from './domain.mjs';

// Read-only projection of the owner's saved history, before UI pagination.
// Uses the same purchase/refund and pending-replacement rules as the ledger.
export function activityRange(params,now=new Date()) {
  if(!params.has('activityStart')&&!params.has('activityEnd')){const end=today(now);return {start:end.slice(0,7)+'-01',end};}
  const start=params.get('activityStart'),end=params.get('activityEnd');
  if(params.getAll('activityStart').length!==1||params.getAll('activityEnd').length!==1||!validDate(start)||!validDate(end)||start>end||end>today(now))throw new RangeError('Choose a valid historical date range ending today or earlier.');
  return {start,end};
}
export function periodActivity(transactions,{start,end},incomplete=false) {
  const key=(t,id=t.id)=>(t.environment||'production')+':'+id;
  const all=transactions.filter(t=>!t.removed),posted=new Set(all.filter(t=>!t.pending&&t.pendingId).map(t=>key(t,t.pendingId)));
  const entries=all.filter(t=>!posted.has(key(t))&&validDate(t.date)&&t.date>=start&&t.date<=end)
    .sort((a,b)=>b.date.localeCompare(a.date)||String(a.id).localeCompare(String(b.id)));
  const real=entries.filter(t=>!t.excludedFromTotals&&t.environment!=='sandbox');
  const purchases=real.filter(t=>!t.pending&&t.currency==='USD'&&t.classification==='purchase');
  const group=field=>Object.entries(purchases.reduce((out,t)=>{const name=t[field]||'Uncategorized';out[name]=(out[name]||0)+t.amountCents;return out;},Object.create(null)))
    .map(([name,amountCents])=>({name,amountCents})).sort((a,b)=>b.amountCents-a.amountCents||a.name.localeCompare(b.name));
  return {entries,summary:{start,end,complete:!incomplete,amountCents:purchases.reduce((sum,t)=>sum+t.amountCents,0),
    refundsCents:purchases.filter(t=>t.amountCents<0).reduce((sum,t)=>sum-t.amountCents,0),
    pendingCents:real.filter(t=>t.pending&&t.currency==='USD'&&t.classification==='purchase').reduce((sum,t)=>sum+t.amountCents,0),
    byMerchant:group('merchant'),byCategory:group('category'),purchaseCount:purchases.length,productionCount:real.length,recent:real.slice(0,5)}};
}

/** Exact Chicago calendar boundaries, including days crossing DST changes. */
export function activityWindow({start,end}) {
  function midnight(day){
    const base=Date.parse(day+'T00:00:00Z');let result=base;
    for(let i=0;i<2;i++){
      const zone=new Intl.DateTimeFormat('en-US',{timeZone:'America/Chicago',timeZoneName:'longOffset'}).formatToParts(new Date(result)).find(p=>p.type==='timeZoneName').value;
      const [,sign,hours,minutes]=/^GMT([+-])(\d{2}):(\d{2})$/.exec(zone);
      result=base-(sign==='-'?-1:1)*(Number(hours)*60+Number(minutes))*60000;
    }
    return Math.floor(result/1000);
  }
  const next=new Date(end+'T12:00:00Z');next.setUTCDate(next.getUTCDate()+1);
  return {after:midnight(start),before:midnight(next.toISOString().slice(0,10))};
}

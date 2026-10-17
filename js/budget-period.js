const zone='America/Chicago';
export function budgetToday(now=new Date()) {
 const parts=new Intl.DateTimeFormat('en-US',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);
 const value=type=>parts.find(p=>p.type===type).value;
 return value('year')+'-'+value('month')+'-'+value('day');
}
const valid=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value+'T12:00:00Z'))&&new Date(value+'T12:00:00Z').toISOString().slice(0,10)===value;
export function validateBudgetRange(start,end,now=new Date()) {
 if(!valid(start)||!valid(end)||start>end||end>budgetToday(now))throw Error('Choose a valid start and end date, ending today or earlier.');
 return {start,end};
}
export function budgetPreset(preset='7',now=new Date()) {
 const end=budgetToday(now);
 if(preset==='month')return {preset,start:end.slice(0,7)+'-01',end};
 const days=preset==='30'?30:7,start=new Date(end+'T12:00:00Z');start.setUTCDate(start.getUTCDate()-(days-1));
 return {preset:preset==='30'?'30':'7',start:start.toISOString().slice(0,10),end};
}

// Pure budget rules. Currency is stored as integer cents; dates are calendar dates.
export const TIMEZONE = 'America/Chicago';
export const MERCHANTS = [
  ['google-home','Google Home Pro',['google home pro','google home premium','google nest aware','nest aware'], 'Home',true],
  ['chatgpt','ChatGPT',['chatgpt','openai'], 'Software',true],
  ['tmobile','T-Mobile',['t-mobile','tmobile','t mobile'], 'Phone',true],
  ['disney','Disney+',['disney+','disney plus','disneyplus'], 'Entertainment',true],
  ['hulu','Hulu',['hulu'], 'Entertainment',true],
  ['walmart-plus','Walmart+',['walmart+','walmart plus','walmartplus','wmt plus','wmtplus'], 'Memberships',true],
  ['amazon-prime','Amazon Prime',['amazon prime','amazonprime','amznprime','amzn prime','prime membership'], 'Memberships',true],
  ['paramount','Paramount+',['paramount+','paramount plus','paramountplus','cbs all access'], 'Entertainment',true],
  ['boone-electric','Boone Electric',['boone electric','booneelectric'], 'Utilities',false],
  ['culligan','Culligan',['culligan'], 'Utilities',false],
  ['consolidated-water','Consolidated Water',['consolidated water','consolidatedwater'], 'Utilities',false],
  ['socket','Socket',['socket telecom','socket.net','socket internet','socket communications'], 'Internet',false],
  ['adventure-club','Adventure Club',['adventure club','adventureclub'], 'Childcare',false],
  ['tfs','Bankruptcy / TFS',['tfs bill','tfsbill','tfsbankruptcy','tfs bankruptcy','tfs payment'], 'Obligations',false],
  ['child-support','Child support',['child support','childsupport'], 'Obligations',false],
  ['mortgage','Mortgage',['mortgage'], 'Housing',false],
  ['paypal','PayPal',['paypal'], 'Uncategorized',false],
  ['walmart','Walmart purchases',['walmart','wal-mart','wal mart','wmt '], 'Shopping',false],
  ['uber-eats','Uber Eats',['uber eats','ubereats','uber *eats'], 'Food delivery',false],
  ['doordash','DoorDash',['doordash','door dash'], 'Food delivery',false],
  ['grubhub','Grubhub',['grubhub','grub hub'], 'Food delivery',false],
  ['uber','Uber rides',['uber trip','uber ride','uber *trip'], 'Transport',false],
  ['amazon','Amazon orders',['amazon','amzn','amz*'], 'Shopping',false]
].map(([id,name,aliases,category,subscription])=>({id,name,aliases,category,subscription}));
const key = value => String(value||'').toLowerCase().normalize('NFKC').replace(/[’']/g,'').replace(/\s+/g,' ').trim();
export function merchantFor(text) {
  const value=key(text);
  return MERCHANTS.find(m=>m.aliases.some(alias=>value.includes(alias)))||null;
}
export function money(value) {
  if(value===null||value===undefined||value==='')return null;
  if(!['string','number'].includes(typeof value))throw Error('Invalid amount type.');
  if(typeof value==='string'&&!/^-?\d+(?:\.\d{1,2})?$/.test(value))throw Error('Use an amount with at most two decimal places.');
  const number=Number(value),cents=Math.round((number+Number.EPSILON)*100);
  if(!Number.isFinite(number)||!Number.isSafeInteger(cents)||Math.abs(number*100-cents)>0.000001||Math.abs(cents)>100000000000)throw Error('Invalid amount.');
  return cents;
}
export function validDate(value) {
  return typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&!Number.isNaN(Date.parse(value))&&new Date(value+'T12:00:00Z').toISOString().slice(0,10)===value;
}
export function today(now=new Date()) {
  const parts=new Intl.DateTimeFormat('en-US',{timeZone:TIMEZONE,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);
  return ['year','month','day'].map(type=>parts.find(p=>p.type===type).value).join('-');
}
export function addDays(date,days){const d=new Date(date+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+days);return d.toISOString().slice(0,10);}
export function monthDate(month,day){const [y,m]=month.split('-').map(Number),last=new Date(Date.UTC(y,m,0)).getUTCDate();return `${month}-${String(Math.min(day,last)).padStart(2,'0')}`;}
function shiftMonth(month,offset){const [y,m]=month.split('-').map(Number);return new Date(Date.UTC(y,m-1+offset,1)).toISOString().slice(0,7);}
export function seedBills() {
  return [
    ...MERCHANTS.filter(m=>m.subscription||['boone-electric','culligan','consolidated-water','socket','adventure-club','tfs'].includes(m.id)).map(m=>({id:m.id,name:m.name,merchantId:m.id,category:m.category,subscription:m.subscription,amountCents:null,frequency:null,day:null,nextDate:null,contractualDueDate:null,status:'unconfirmed',certainty:'unconfirmed',variable:['boone-electric','culligan','consolidated-water'].includes(m.id),notes:m.id==='google-home'?'Exact service name needs receipt verification.':m.id==='tfs'?'Frequency and due date need confirmation.':'Needs source evidence or your confirmation.'})),
    ...['child-support','mortgage'].map(id=>{const m=MERCHANTS.find(m=>m.id===id);return {id,name:m.name,merchantId:id,category:m.category,amountCents:null,frequency:null,day:null,contractualDueDate:null,status:'unconfirmed',certainty:'unconfirmed',subscription:false,notes:'Enter your obligation and deadline privately. A contractual due date can be retained separately.'};})
  ];
}
export function occurrences(bill,start,end) {
  if(bill.status==='cancelled'||bill.status==='unconfirmed'||!Number.isInteger(bill.amountCents))return [];
  const dates=[];
  if(bill.variable){if(validDate(bill.nextDate))dates.push(bill.nextDate);}
  else if(bill.frequency==='monthly'&&Number.isInteger(bill.day)){
    for(let month=start.slice(0,7);month<=end.slice(0,7);month=shiftMonth(month,1))dates.push(monthDate(month,bill.day));
  }else if(['annual','quarterly'].includes(bill.frequency)&&validDate(bill.nextDate)){
    const step=bill.frequency==='annual'?12:3;
    for(let month=bill.nextDate.slice(0,7),n=0;month<=end.slice(0,7)&&n<48;month=shiftMonth(month,step),n++)dates.push(monthDate(month,Number(bill.nextDate.slice(8))));
  }else if(validDate(bill.nextDate))dates.push(bill.nextDate);
  return dates.filter(date=>date>=start&&date<=end).map(date=>({id:bill.id+':'+date,billId:bill.id,name:bill.name,merchantId:bill.merchantId,category:bill.category,date,amountCents:bill.amountCents,certainty:bill.certainty||'user-stated',subscription:!!bill.subscription,paymentStatus:'unknown',source:'manual',contractualDueDate:bill.contractualDueDate||null}));
}
function orderKey(receipt){return receipt.orderId?`${receipt.merchantId}:${key(receipt.orderId)}`:null;}
export function uniqueReceipts(receipts) {
  const groups=new Map(),out=[];
  for(const receipt of [...receipts].sort((a,b)=>(b.date||'').localeCompare(a.date||''))){
    const id=orderKey(receipt);if(!id){out.push(receipt);continue;}
    const previous=groups.get(id);
    if(previous){previous.sourceIds.push(receipt.id);if(previous.amountCents!==receipt.amountCents)previous.conflict=true;}
    else{const copy={...receipt,sourceIds:[receipt.id]};groups.set(id,copy);out.push(copy);}
  }
  return out;
}
const dayGap=(a,b)=>Math.abs(Date.parse(a+'T12:00:00Z')-Date.parse(b+'T12:00:00Z'))/86400000;
export function matchReceipts(transactions,observations) {
  const used=new Set(),matches=[],review=[],byMerchant=new Map();
  for(const transaction of transactions){if(!byMerchant.has(transaction.merchantId))byMerchant.set(transaction.merchantId,[]);byMerchant.get(transaction.merchantId).push(transaction);}
  for(const receipt of uniqueReceipts(observations.filter(o=>o.kind==='receipt'&&Number.isInteger(o.amountCents)&&validDate(o.date)))){
    if(receipt.conflict){review.push({id:'receipt:'+receipt.id,reason:'Conflicting totals for the same order',observationId:receipt.id});continue;}
    const candidates=(byMerchant.get(receipt.merchantId)||[]).filter(t=>!t.removed&&!t.pending&&!used.has(t.id)&&t.currency==='USD'&&receipt.currency==='USD'&&t.amountCents>0&&dayGap(t.date,receipt.date)<=14);
    const exact=candidates.filter(t=>t.amountCents===receipt.amountCents);
    let selected=exact.length===1?[exact[0]]:null;
    if(exact.length>1)review.push({id:'match:'+receipt.id,reason:'More than one bank payment could match this receipt',observationId:receipt.id,candidateIds:exact.map(t=>t.id)});
    else if(!selected&&candidates.length<=8){
      const combinations=[];
      const search=(at,picked,total)=>{if(picked.length>1&&total===receipt.amountCents){combinations.push([...picked]);return;}if(picked.length===5||total>=receipt.amountCents)return;for(let i=at;i<candidates.length;i++)search(i+1,[...picked,candidates[i]],total+candidates[i].amountCents);};
      search(0,[],0);
      if(combinations.length===1)selected=combinations[0];
      else if(combinations.length>1)review.push({id:'split:'+receipt.id,reason:'Several split-shipment combinations match; choose the actual payments',observationId:receipt.id});
    }
    if(selected){selected.forEach(t=>used.add(t.id));matches.push({observationId:receipt.id,sourceIds:receipt.sourceIds||[receipt.id],transactionIds:selected.map(t=>t.id),kind:selected.length>1?'split-shipment':'exact'});}
    else if(!exact.length)review.push({id:'unmatched:'+receipt.id,reason:'Receipt has no confirmed bank match; excluded from bank spending totals',observationId:receipt.id});
  }
  return {matches,review};
}
export function normalizeTransaction(transaction,environment='production') {
  const text=transaction.merchant_name||transaction.name||'',merchant=merchantFor(((transaction.merchant_name||'')+' '+(transaction.name||'')).replace(/paypal/gi,''))||merchantFor((transaction.merchant_name||'')+' '+(transaction.name||'')),category=transaction.personal_finance_category?.detailed||transaction.personal_finance_category?.primary||'Uncategorized';
  const transfer=/^TRANSFER_(IN|OUT)/.test(category)||/CREDIT_CARD_PAYMENT/.test(category)||/credit card payment/i.test(text);
  const explicitP2P=/person.to.person|friends.and.family|money (sent|received)|p2p transfer/i.test(text);
  const ambiguousPaypal=merchant?.id==='paypal'&&!explicitP2P;
  return {id:transaction.transaction_id,accountId:transaction.account_id,date:transaction.date,authorizedDate:transaction.authorized_date||null,name:text.slice(0,200),merchantId:merchant?.id||key(text).replace(/[^a-z0-9]+/g,'-').slice(0,80)||'unknown',merchant:merchant?.name||text.slice(0,120)||'Unknown merchant',category:merchant?.category||category,amountCents:money(transaction.amount),currency:transaction.iso_currency_code||transaction.unofficial_currency_code||null,pending:!!transaction.pending,pendingId:transaction.pending_transaction_id||null,classification:transfer?'transfer':explicitP2P?'p2p':ambiguousPaypal?'review':'purchase',channel:/paypal/i.test(text)?'PayPal':null,environment,removed:false};
}
export function incomeOccurrences(plan,start,end) {
  if(!Number.isInteger(plan.amountCents)||plan.amountCents<0||!validDate(plan.nextDate))return [];
  if(plan.frequency==='monthly')return occurrences({...plan,name:plan.name||'Income',status:'active',day:Number(plan.nextDate.slice(8)),certainty:'user-stated'},plan.nextDate>start?plan.nextDate:start,end);
  const dates=[];let date=plan.nextDate,step=plan.frequency==='weekly'?7:plan.frequency==='biweekly'?14:null;
  for(let i=0;i<400&&date<=end;i++){if(date>=start)dates.push({date,amountCents:plan.amountCents,name:plan.name||'Income',source:'user-stated'});if(!step)break;date=addDays(date,step);}
  return dates;
}
export function buildSummary({accounts=[],transactions=[],bills=[],events=[],observations=[],annotations=[],incomes=[],settings={},incomplete=false},now=new Date()) {
  const date=today(now),end7=addDays(date,7),end30=addDays(date,30),month=date.slice(0,7),start=month+'-01';
  const annotationMap=new Map(annotations.map(a=>[a.id,a]));
  const liveTransactions=transactions.filter(t=>!t.removed&&t.environment!=='sandbox').map(t=>({...t,...annotationMap.get(t.id)}));
  const posted=new Map(liveTransactions.filter(t=>!t.pending&&t.pendingId).map(t=>[t.pendingId,t.id]));
  const deduped=liveTransactions.filter(t=>!posted.has(t.id));
  const recurrence=bills.flatMap(b=>occurrences(b,start,end30)),byEvent=new Map(recurrence.map(e=>[e.id,e]));
  for(const event of events){
    const manual=recurrence.find(e=>e.billId===event.billId&&e.date.slice(0,7)===event.date?.slice(0,7));
    if(manual){byEvent.set(manual.id,{...manual,...event,id:manual.id,date:manual.date,contractualDueDate:event.contractualDueDate||event.date});}
    else byEvent.set(event.id,event);
  }
  const billEvents=[...byEvent.values()].map(event=>{
    const payments=deduped.filter(t=>!t.pending&&t.amountCents>0&&t.merchantId===event.merchantId&&t.amountCents===event.amountCents&&validDate(event.date)&&dayGap(t.date,event.date)<=7);
    const pending=deduped.filter(t=>t.pending&&t.merchantId===event.merchantId&&t.amountCents===event.amountCents&&validDate(event.date)&&dayGap(t.date,event.date)<=7);
    const paid=event.paymentStatus==='paid'||payments.length===1;
    return {...event,paymentStatus:paid?'paid':event.paymentStatus||'unknown',reflectedTransactionId:payments.length===1?payments[0].id:null,pendingTransactionId:pending.length===1?pending[0].id:null,status:paid?'paid':!validDate(event.date)||!Number.isInteger(event.amountCents)?'unconfirmed':event.date<date?(event.paymentStatus==='unpaid'?'overdue':'unconfirmed'):'upcoming'};
  });
  const active=bills.filter(b=>b.status!=='cancelled'),knownRecurring=active.filter(b=>b.status==='active'&&!b.variable&&Number.isInteger(b.amountCents)&&['monthly','annual','quarterly'].includes(b.frequency));
  const monthlyCents=knownRecurring.reduce((sum,b)=>sum+Math.round(b.amountCents/(b.frequency==='annual'?12:b.frequency==='quarterly'?3:1)),0);
  const cash=accounts.filter(a=>a.environment!=='sandbox'&&a.type==='depository'&&a.included!==false),currencyComplete=cash.every(a=>a.currency==='USD');
  const total=field=>cash.length&&currencyComplete&&cash.every(a=>Number.isInteger(a[field]))?cash.reduce((sum,a)=>sum+a[field],0):null;
  const availableCents=total('availableCents'),currentCents=total('currentCents'),base=availableCents??currentCents,baseKind=availableCents!==null?'available':'current';
  const staleCash=cash.some(a=>a.disconnected||!a.balanceAt||!Number.isFinite(Date.parse(a.balanceAt))||now.getTime()-Date.parse(a.balanceAt)>86400000);
  const upcoming=billEvents.filter(e=>e.status==='upcoming'&&e.date>=date&&e.date<=end30).sort((a,b)=>a.date.localeCompare(b.date)),deductions=upcoming.filter(e=>!e.reflectedTransactionId&&!(baseKind==='available'&&e.pendingTransactionId&&deduped.find(t=>t.id===e.pendingTransactionId&&cash.some(a=>a.id===t.accountId))));
  const income=incomes.flatMap(p=>incomeOccurrences(p,date,end30)),billCents=deductions.reduce((sum,e)=>sum+e.amountCents,0),incomeCents=income.reduce((sum,e)=>sum+e.amountCents,0);
  const projection=base===null||incomplete||staleCash?null:{start:date,end:end30,baseCents:base,baseKind,billCents,incomeCents,cushionCents:settings.cushionCents??null,afterBillsCents:base-billCents+incomeCents,deductedBillIds:deductions.map(e=>e.id),pendingAlreadyReservedIds:upcoming.filter(e=>!deductions.includes(e)).map(e=>e.id),incomeDates:income,coverageComplete:!!settings.coverageComplete,incomeProvided:incomes.length>0};
  const spend=deduped.filter(t=>t.date>=start&&t.date<=date&&!t.pending&&t.currency==='USD'&&t.classification==='purchase'),groupBy=field=>Object.entries(spend.reduce((out,t)=>{const label=t[field]||'Uncategorized';out[label]=(out[label]||0)+t.amountCents;return out;},{})).map(([name,amountCents])=>({name,amountCents})).sort((a,b)=>b.amountCents-a.amountCents);
  const matched=matchReceipts(deduped,observations);
  const review=[...matched.review,...observations.filter(o=>o.merchantId==='unidentified'||(!['cancellation','refund'].includes(o.kind)&&o.amountCents===null)||o.kind==='bill'&&!o.dueDate).map(o=>({id:'fields:'+o.id,observationId:o.id,reason:'Merchant, amount, or invoice due date needs confirmation'})),...active.filter(b=>b.status==='unconfirmed'||b.amountCents===null||!b.frequency||b.frequency==='monthly'&&!b.day&&!b.nextDate||b.frequency==='annual'&&!b.nextDate).map(b=>({id:'bill:'+b.id,billId:b.id,reason:b.notes||'Amount, frequency, or due date needs confirmation'})),...deduped.filter(t=>t.classification==='review').map(t=>({id:'transaction:'+t.id,transactionId:t.id,reason:'PayPal purchase or person-to-person transfer needs classification'})),...observations.filter(o=>o.conflicts?.length).map(o=>({id:'evidence:'+o.id,observationId:o.id,reason:o.conflicts.join('; ')}))];
  return {date,timeZone:TIMEZONE,window:{start:date,end7,end30},availableCents,currentCents,cashAccountCount:cash.length,staleCash,balanceAsOf:cash.map(a=>a.balanceAt).filter(Boolean).sort()[0]||null,projection,bills:billEvents.sort((a,b)=>(a.date||'9999').localeCompare(b.date||'9999')),next7:upcoming.filter(e=>e.date<=end7),next30:upcoming,monthlyCommitments:{amountCents:monthlyCents,unconfirmedCount:active.length-knownRecurring.length,includesMonthlyEquivalents:true},annualRenewals:bills.filter(b=>b.frequency==='annual'&&b.status!=='cancelled'),spending:{start,end:date,amountCents:spend.reduce((sum,t)=>sum+t.amountCents,0),byMerchant:groupBy('merchant'),byCategory:groupBy('category'),pendingCents:deduped.filter(t=>t.pending&&t.date>=start&&t.classification==='purchase'&&t.currency==='USD').reduce((sum,t)=>sum+t.amountCents,0),receiptOnlyCount:observations.filter(o=>o.kind==='receipt').length-matched.matches.length,refundsCents:spend.filter(t=>t.amountCents<0).reduce((sum,t)=>sum-t.amountCents,0)},matches:matched.matches,review,incomplete};
}

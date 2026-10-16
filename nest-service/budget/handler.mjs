import {BudgetStore} from './store.mjs';
import {BudgetError,plaidConfigured,plaidEnvironment,plaidCall,bankCandidates,institutionSupported,verifyWebhook} from './plaid.mjs';
import {buildSummary,money,validDate,merchantFor} from './domain.mjs';
import {runBudgetJob,storeAccounts} from './sync.mjs';

const json=(env,data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store, private','Pragma':'no-cache','Access-Control-Allow-Origin':env.FRONTEND_ORIGIN,'Vary':'Origin','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff'}});
const needDb=env=>{if(!env.BUDGET_DB)throw new BudgetError(503,'The private budget database is not yet deployed. Your other dashboard connections still work.','DATABASE_SETUP');};
const id=value=>{if(typeof value!=='string'||!/^[A-Za-z0-9:_-]{1,200}$/.test(value))throw new BudgetError(400,'Invalid record identifier.');return value;};
const clean=(value,max=160)=>typeof value==='string'?value.trim().slice(0,max):'';
const amount=(value,allowNull=true)=>{if(value===null&&allowNull)return null;let result;try{result=money(value);}catch{throw new BudgetError(400,'Enter an amount with at most two decimal places.');}if(result===null||result<0)throw new BudgetError(400,'Enter a non-negative amount.');return result;};
function budgetBill(input,previous={}) {
  const name=clean(input.name);if(!name)throw new BudgetError(400,'A bill name is required.');
  if(![null,'monthly','annual','quarterly','one-time'].includes(input.frequency))throw new BudgetError(400,'Choose a supported billing frequency.');
  if(input.day!==null&&(!Number.isInteger(input.day)||input.day<1||input.day>31))throw new BudgetError(400,'Choose a day from 1 to 31, or leave it unconfirmed.');
  for(const key of ['nextDate','contractualDueDate'])if(input[key]&&!validDate(input[key]))throw new BudgetError(400,'Use a complete valid calendar date.');
  if(!['active','cancelled','unconfirmed'].includes(input.status))throw new BudgetError(400,'Invalid bill status.');
  return {...previous,id:input.id||crypto.randomUUID(),name,merchantId:clean(input.merchantId||previous.merchantId||input.id||'manual',80),category:clean(input.category||'Uncategorized',60),amountCents:amount(input.amount),frequency:input.frequency,day:input.day,nextDate:input.nextDate||null,contractualDueDate:input.contractualDueDate||previous.contractualDueDate||null,subscription:input.subscription===true,variable:input.variable===true,status:input.status,notes:clean(input.notes,500),certainty:'user-stated',manual:true};
}
function publicItem(item){return {id:item.id,name:item.name,institutionId:item.institutionId,institutionUrl:item.institutionUrl,environment:item.environment,status:item.status,lastSync:item.lastSync||null,error:item.error||null,historyStatus:item.historyStatus||'Not yet verified'};}
function publicSource(source){return {id:source.id,email:source.email,primary:source.primary,enabled:source.enabled,lastSync:source.lastSync||null,lastBatchAt:source.lastBatchAt||null,backfillComplete:!!source.backfillComplete,processedCount:source.processedCount||0,error:source.error||null};}
export async function snapshot(store,env,url) {
  const names=['account','transaction','bill','event','observation','annotation','income','settings','item','mail-source','proposal','observation-override','event-override','match-override','review-resolution'];
  const lists=await Promise.all(names.map(name=>store.list(name))),rows=Object.fromEntries(names.map((name,i)=>[name,lists[i]]));
  const overrides=new Map(rows['observation-override'].map(o=>[o.id,o])),eventOverrides=new Map(rows['event-override'].map(o=>[o.id,o]));
  rows.observation=rows.observation.map(o=>({...o,...overrides.get(o.id)}));rows.event=rows.event.map(e=>({...e,...eventOverrides.get(e.id)}));
  const annotations=new Map(rows.annotation.map(a=>[a.id,a]));rows.transaction=rows.transaction.map(t=>({...t,...annotations.get(t.id)}));
  const items=new Map(rows.item.map(i=>[i.id,i]));rows.account=rows.account.map(a=>({...a,disconnected:items.get(a.itemId)?.status==='disconnected'}));
  const incomplete=lists.some(list=>list.length>10000),summary=buildSummary({accounts:rows.account,transactions:rows.transaction,bills:rows.bill,events:rows.event,observations:rows.observation,annotations:rows.annotation,incomes:rows.income,settings:rows.settings[0]||{},incomplete});
  summary.review.push(...rows.proposal.map(p=>({id:'proposal:'+p.id,observationId:p.id,reason:p.reason})));
  const transactionIdsPresent=new Set(rows.transaction.map(t=>t.id)),manualMatches=rows['match-override'].filter(m=>m.transactionIds?.every(id=>transactionIdsPresent.has(id)));
  summary.matches.push(...manualMatches);const resolved=new Set(manualMatches.map(m=>m.observationId)),reviewResolved=new Set(rows['review-resolution'].map(r=>r.id));summary.review=summary.review.filter(r=>(!r.observationId||!resolved.has(r.observationId))&&!reviewResolved.has(r.id));
  const transactionPage=Math.max(0,Math.min(1000,Number(url.searchParams.get('transactionPage'))||0)),reviewPage=Math.max(0,Math.min(1000,Number(url.searchParams.get('reviewPage'))||0));
  const transactions=rows.transaction.sort((a,b)=>(b.date||'').localeCompare(a.date||'')),reviewCount=summary.review.length;
  summary.review=summary.review.slice(reviewPage*50,reviewPage*50+50);
  const evidenceIds=new Set(summary.review.map(r=>r.observationId).filter(Boolean)),evidence=rows.observation.filter(o=>evidenceIds.has(o.id));
  const transactionIds=new Set(summary.review.map(r=>r.transactionId).filter(Boolean));
  return {configured:true,environment:plaidEnvironment(env),bankConfigured:plaidConfigured(env),timeZone:'America/Chicago',settings:rows.settings[0]||{},accounts:rows.account,bills:rows.bill,incomes:rows.income,items:rows.item.map(publicItem),mailSources:rows['mail-source'].map(publicSource),observations:[...evidence,...rows.observation.filter(o=>!evidenceIds.has(o.id)).slice(0,300)],reviewTransactions:transactions.filter(t=>transactionIds.has(t.id)),transactions:transactions.slice(transactionPage*50,transactionPage*50+50),transactionCount:transactions.length,reviewCount,summary,jobs:await store.jobs(),retrievedAt:new Date().toISOString()};
}
async function readInput(request,deps){if(!request.headers.get('Content-Type')?.startsWith('application/json'))throw new BudgetError(415,'Use JSON.');return deps.boundedJson(request,65536);}
export async function handleBudget(request,env,owner,sessionId,deps) {
  const url=new URL(request.url),path=url.pathname.slice('/budget'.length);
  needDb(env);const store=new BudgetStore(env.BUDGET_DB,owner);
  if(path==='/snapshot'&&request.method==='GET'){await store.initialize();return json(env,await snapshot(store,env,url));}
  if(path==='/institutions'&&request.method==='GET')return json(env,{environment:plaidEnvironment(env),institutions:await bankCandidates(env,deps.boundedJson),checkedAt:new Date().toISOString(),liveCoverageVerified:plaidEnvironment(env)==='production'});
  if(path==='/transactions'&&request.method==='GET'){
    const merchant=clean(url.searchParams.get('merchantId'),80),around=url.searchParams.get('date');
    const annotations=new Map((await store.list('annotation')).map(a=>[a.id,a]));const transactions=(await store.list('transaction')).map(t=>({...t,...annotations.get(t.id)})).filter(t=>!merchant||t.merchantId===merchant).filter(t=>!validDate(around)||Math.abs(Date.parse(t.date)-Date.parse(around))<=30*86400000).slice(0,100);
    return json(env,{transactions});
  }
  if(request.method!=='POST')throw new BudgetError(405,'Use an authenticated POST for budget changes.');
  const input=await readInput(request,deps);await store.initialize();
  const lock=path==='/sync'?null:await store.lock();if(path!=='/sync'&&!lock)throw new BudgetError(409,'A budget sync is finishing. Try this change again in a moment.');
  try{
  if(path==='/settings'){
    const previous=await store.get('settings','main'),limits=Array.isArray(input.limits)?input.limits.slice(0,100).map(l=>({category:clean(l.category,60),amountCents:amount(l.amount,false)})):previous.limits;
    await store.put('settings','main',{...previous,cushionCents:amount(input.cushion),coverageComplete:input.coverageComplete===true,limits});return json(env,{saved:true});
  }
  if(path==='/bill'){
    const previous=input.id?await store.get('bill',id(input.id)):null;if(input.id&&!previous)throw new BudgetError(404,'Bill not found.');
    const bill=budgetBill(input,previous||{});await store.put('bill',bill.id,bill);return json(env,{saved:true,id:bill.id});
  }
  if(path==='/income'){
    if(!['once','weekly','biweekly','monthly'].includes(input.frequency)||!validDate(input.nextDate))throw new BudgetError(400,'Enter a payday and a supported repeat schedule.');
    const row={id:input.id?id(input.id):crypto.randomUUID(),name:clean(input.name||'Income'),amountCents:amount(input.amount,false),nextDate:input.nextDate,frequency:input.frequency};
    if(input.id&&!await store.get('income',row.id))throw new BudgetError(404,'Income plan not found.');
    await store.put('income',row.id,row);return json(env,{saved:true,id:row.id});
  }
  if(path==='/income/remove'){await store.remove('income',id(input.id));return json(env,{removed:true});}
  if(path==='/account'){
    const account=await store.get('account',id(input.id));if(!account)throw new BudgetError(404,'Account not found.');
    await store.put('account',account.id,{...account,included:input.included===true});return json(env,{saved:true});
  }
  if(path==='/transaction'){
    const transaction=await store.get('transaction',id(input.id));if(!transaction)throw new BudgetError(404,'Transaction not found.');
    if(!['purchase','transfer','p2p'].includes(input.classification))throw new BudgetError(400,'Choose purchase, transfer, or person-to-person.');
    await store.put('annotation',transaction.id,{id:transaction.id,category:clean(input.category,60)||'Uncategorized',classification:input.classification,merchant:clean(input.merchant||transaction.merchant),merchantId:merchantFor(input.merchant)?.id||transaction.merchantId,correctedAt:new Date().toISOString()});return json(env,{saved:true});
  }
  if(path==='/observation'){
    const observation=await store.get('observation',id(input.id));if(!observation)throw new BudgetError(404,'Email evidence not found.');
    if(input.dueDate&&!validDate(input.dueDate))throw new BudgetError(400,'Enter a complete due date.');
    if(![null,'monthly','annual','quarterly'].includes(input.frequency))throw new BudgetError(400,'Invalid frequency.');
    const correction={id:observation.id,sourceId:observation.sourceId,amountCents:amount(input.amount),dueDate:input.dueDate||null,merchantId:clean(input.merchantId||observation.merchantId,80),frequency:input.frequency,conflicts:[],certainty:{amount:'user-corrected',dueDate:'user-corrected',frequency:'user-corrected'}};
    const statements=[store.putStatement('observation-override',observation.id,correction),store.statement("DELETE FROM budget_records WHERE owner_id=? AND kind='event' AND json_extract(data,'$.observationId')=?",owner,observation.id)];
    const bill=await store.get('bill',correction.merchantId);
    if(bill&&correction.dueDate&&Number.isInteger(correction.amountCents)){
      const event={id:bill.id+':'+correction.dueDate,billId:bill.id,name:bill.name,merchantId:bill.merchantId,category:bill.category,date:correction.dueDate,contractualDueDate:correction.dueDate,amountCents:correction.amountCents,paymentStatus:observation.paymentStatus,certainty:'user-corrected',source:'email',sourceId:observation.sourceId,sourceUrl:observation.sourceUrl,observationId:observation.id,receivedAt:new Date().toISOString(),subscription:!!bill.subscription};statements.push(store.putStatement('event',event.id,event));
    }
    await store.db.batch(statements);return json(env,{saved:true});
  }
  if(path==='/review/resolve'){const reviewId=clean(input.id,240);if(!reviewId||input.confirmed!==true)throw new BudgetError(400,'Explicitly confirm the review is resolved.');await store.put('review-resolution',reviewId,{id:reviewId,resolvedAt:new Date().toISOString()});return json(env,{saved:true});}
  if(path==='/event'){
    if(!['paid','unpaid','unknown'].includes(input.paymentStatus)||!validDate(input.date))throw new BudgetError(400,'Choose a valid bill date and payment status.');
    const bill=await store.get('bill',id(input.billId));if(!bill)throw new BudgetError(404,'Bill not found.');
    const event={id:bill.id+':'+input.date,billId:bill.id,name:bill.name,merchantId:bill.merchantId,category:bill.category,date:input.date,amountCents:amount(input.amount,false),paymentStatus:input.paymentStatus,certainty:'user-stated',source:'manual',subscription:!!bill.subscription};
    await store.put('event',event.id,event);return json(env,{saved:true});
  }
  if(path==='/match'){
    const observation=await store.get('observation',id(input.observationId));if(!observation||input.confirmed!==true||!Array.isArray(input.transactionIds)||!input.transactionIds.length||input.transactionIds.length>20)throw new BudgetError(400,'Select the bank entries and explicitly confirm the match.');
    const transactionIds=[...new Set(input.transactionIds.map(id))];for(const transactionId of transactionIds){const transaction=await store.get('transaction',transactionId);if(!transaction)throw new BudgetError(404,'A selected transaction does not belong to this budget.');if(transaction.pending)throw new BudgetError(400,'Wait for pending payments to post before confirming a receipt match.');}
    await store.put('match-override',observation.id,{id:observation.id,observationId:observation.id,transactionIds,kind:'user-confirmed'});return json(env,{saved:true});
  }
  if(path==='/mail/enable'){
    const email=env.OWNER_EMAIL.toLowerCase(),sourceId=await deps.hash(email),previous=await store.get('mail-source',sourceId);
    await store.put('mail-source',sourceId,{...previous,id:sourceId,email,primary:true,enabled:true});await store.queue('mail',sourceId);return json(env,{queued:true});
  }
  if(path==='/mail/connect'){
    const expected=String(env.BUDGET_SECONDARY_EMAIL||'sage4997@gmail.com').toLowerCase();
    const settings=await store.get('settings','main');
    const ticket=deps.random();await deps.putRecord(env,'budget-ticket:'+await deps.hash(ticket),{owner,ownerEmail:env.OWNER_EMAIL.toLowerCase(),sessionId,expected,generation:settings.generation,expires:Date.now()+120000},120);
    return json(env,{url:url.origin+'/auth/budget-mail?ticket='+ticket});
  }
  if(path==='/mail/disconnect'){
    const source=await store.get('mail-source',id(input.id));if(!source)throw new BudgetError(404,'Gmail source not found.');
    if(input.deleteData===true&&input.confirmation!=='DELETE SOURCE DATA')throw new BudgetError(400,'Type DELETE SOURCE DATA to delete saved evidence.');
    await store.put('mail-source',source.id,{...source,enabled:false,status:'disconnected'});
    await store.statement('DELETE FROM budget_jobs WHERE owner_id=? AND kind=? AND source_id=?',owner,'mail',source.id).run();
    if(!source.primary&&source.tokenKey)await env.NEST_KV.delete(source.tokenKey);
    if(input.deleteData===true){if(input.confirmation!=='DELETE SOURCE DATA')throw new BudgetError(400,'Type DELETE SOURCE DATA to delete saved evidence.');await store.deleteSource('mail',source.id);}
    return json(env,{disconnected:true,deleted:input.deleteData===true});
  }
  if(path==='/link-token'){
    if(!input.itemId&&(await store.list('item')).some(i=>i.environment===plaidEnvironment(env)))throw new BudgetError(409,'A bank import already exists in this environment. Use Reconnect bank, or delete the disconnected import before creating a new connection to avoid duplicates.');
    const candidates=await bankCandidates(env,deps.boundedJson);if(!candidates.length)throw new BudgetError(409,'No Central Bank institution currently matches centralbank.net and both Balance and Transactions. Live linking is blocked until coverage is verified.','BANK_COVERAGE');
    const update=input.itemId?await store.get('item',id(input.itemId)):null;if(input.itemId&&!update)throw new BudgetError(404,'Bank connection not found.');
    const token=update?await deps.getRecord(env,update.tokenKey):null;
    const result=await plaidCall(env,'/link/token/create',{client_name:'Sage personal budget',user:{client_user_id:owner},country_codes:['US'],language:'en',redirect_uri:env.FRONTEND_ORIGIN+'/HomePage/',webhook:url.origin+'/budget/plaid/webhook',...(update?{access_token:token?.access}:{products:['transactions'],transactions:{days_requested:365}})},deps.boundedJson);
    await store.put('link-attempt','current',{id:'current',expires:Date.now()+30*60000,itemId:update?.id||null,environment:plaidEnvironment(env)});
    return json(env,{linkToken:result.link_token,expiration:result.expiration,environment:plaidEnvironment(env),institutions:candidates,update:!!update});
  }
  if(path==='/exchange'){
    if(typeof input.publicToken!=='string'||input.publicToken.length>2048)throw new BudgetError(400,'Invalid Link response.');
    const attempt=await store.get('link-attempt','current');if(!attempt||attempt.expires<Date.now()||attempt.environment!==plaidEnvironment(env)||attempt.itemId)throw new BudgetError(400,'Start a fresh bank connection from this dashboard.');
    const exchanged=await plaidCall(env,'/item/public_token/exchange',{public_token:input.publicToken},deps.boundedJson);
    let connectionSaved=false,connectionRemoved=false;try{
    const itemResult=await plaidCall(env,'/item/get',{access_token:exchanged.access_token},deps.boundedJson),institutionId=itemResult.item.institution_id;
    const institutionResult=await plaidCall(env,'/institutions/get_by_id',{institution_id:institutionId,country_codes:['US'],options:{include_optional_metadata:true,include_status:true}},deps.boundedJson),institution=institutionResult.institution;
    if(plaidEnvironment(env)==='production'&&!institutionSupported(institution)){
      await plaidCall(env,'/item/remove',{access_token:exchanged.access_token},deps.boundedJson);connectionRemoved=true;throw new BudgetError(422,'This is not the verified Central Bank personal institution with both required products. The new connection was removed.');
    }
    const tokenKey='budget:plaid:'+owner+':'+exchanged.item_id,item={id:exchanged.item_id,tokenKey,institutionId,name:institution.name,institutionUrl:institution.url||null,environment:plaidEnvironment(env),status:'connected',cursor:null,lastSync:null,providerUpdatedAt:itemResult.status?.transactions?.last_successful_update||null};
    await deps.putRecord(env,tokenKey,{access:exchanged.access_token});await store.put('item',item.id,item);connectionSaved=true;await store.remove('link-attempt','current');
    const accounts=await plaidCall(env,'/accounts/get',{access_token:exchanged.access_token},deps.boundedJson);await storeAccounts(store,accounts.accounts,item);await store.queue('bank',item.id);return json(env,{connected:true,item:publicItem(item)});
    }catch(error){if(!connectionSaved&&!connectionRemoved){try{await plaidCall(env,'/item/remove',{access_token:exchanged.access_token},deps.boundedJson);}catch{const tokenKey='budget:plaid:'+owner+':'+exchanged.item_id;await deps.putRecord(env,tokenKey,{access:exchanged.access_token});await store.put('item',exchanged.item_id,{id:exchanged.item_id,tokenKey,name:'Bank connection requiring cleanup',environment:plaidEnvironment(env),status:'needs-attention',error:'Setup did not finish and disconnection could not be confirmed. Use Disconnect before retrying.'});}}throw error;}
  }
  if(path==='/link-updated'){
    const item=await store.get('item',id(input.itemId));if(!item)throw new BudgetError(404,'Bank connection not found.');await store.put('item',item.id,{...item,status:'connected',error:null});await store.queue('bank',item.id);return json(env,{queued:true});
  }
  if(path==='/balances'){
    const item=await store.get('item',id(input.itemId));if(!item)throw new BudgetError(404,'Bank connection not found.');
    if(item.balanceRequestedAt&&Date.now()-Date.parse(item.balanceRequestedAt)<60000)throw new BudgetError(429,'Wait one minute before another live balance request.');
    const token=await deps.getRecord(env,item.tokenKey);if(!token)throw new BudgetError(409,'Reconnect this bank.');
    const result=await plaidCall(env,'/accounts/balance/get',{access_token:token.access},deps.boundedJson);await storeAccounts(store,result.accounts,item,'on-demand');await store.put('item',item.id,{...item,balanceRequestedAt:new Date().toISOString()});return json(env,{refreshed:true});
  }
  if(path==='/bank/disconnect'){
    const item=await store.get('item',id(input.id));if(!item)throw new BudgetError(404,'Bank connection not found.');
    if(input.deleteData===true&&input.confirmation!=='DELETE SOURCE DATA')throw new BudgetError(400,'Type DELETE SOURCE DATA to delete imported bank data.');
    const token=await deps.getRecord(env,item.tokenKey);if(token)await plaidCall(env,'/item/remove',{access_token:token.access},deps.boundedJson);
    await env.NEST_KV.delete(item.tokenKey);await store.put('item',item.id,{...item,status:'disconnected'});await store.statement('DELETE FROM budget_jobs WHERE owner_id=? AND kind=? AND source_id=?',owner,'bank',item.id).run();
    if(input.deleteData===true)await store.deleteSource('bank',item.id);return json(env,{disconnected:true,deleted:input.deleteData===true});
  }
  if(path==='/sync'){
    const jobs=await store.jobs(),requested=input.jobId?jobs.find(j=>j.id===input.jobId):jobs.find(j=>j.status==='queued'||j.status==='error'&&j.next_run<=Date.now());
    if(!requested)return json(env,{complete:true});
    return json(env,await runBudgetJob(env,owner,requested.id,deps));
  }
  if(path==='/sync/queue'){
    const settings=await store.get('settings','main');if(settings.syncRequestedAt&&Date.now()-Date.parse(settings.syncRequestedAt)<60000)throw new BudgetError(429,'Wait one minute before requesting another full sync.');
    await store.put('settings','main',{...settings,syncRequestedAt:new Date().toISOString()});
    for(const source of await store.list('mail-source'))if(source.enabled)await store.queue('mail',source.id);
    for(const item of await store.list('item'))if(item.status!=='disconnected')await store.queue('bank',item.id);
    return json(env,{queued:true});
  }
  if(path==='/delete'){
    if(input.confirmation!=='DELETE MY BUDGET DATA')throw new BudgetError(400,'Type DELETE MY BUDGET DATA to remove the private budget and its connections.');
    for(const item of await store.list('item')){const token=await deps.getRecord(env,item.tokenKey);if(token)await plaidCall(env,'/item/remove',{access_token:token.access},deps.boundedJson);await env.NEST_KV.delete(item.tokenKey);}
    for(const source of await store.list('mail-source'))if(!source.primary&&source.tokenKey)await env.NEST_KV.delete(source.tokenKey);
    await store.db.batch(['budget_records','budget_jobs','budget_sync_stage'].map(table=>store.statement(`DELETE FROM ${table} WHERE owner_id=?`,owner)));return json(env,{deleted:true});
  }
  throw new BudgetError(404,'Unknown budget operation.');
  }finally{if(lock)await store.unlock(lock);}
}

export async function startBudgetMail(request,env,deps) {
  needDb(env);const url=new URL(request.url),ticket=url.searchParams.get('ticket');if(!/^[a-f0-9]{64}$/.test(ticket||''))throw new BudgetError(400,'Start this connection from your signed-in budget.');
  const ticketKey='budget-ticket:'+await deps.hash(ticket),record=await deps.getRecord(env,ticketKey);await env.NEST_KV.delete(ticketKey);
  if(!record||record.expires<Date.now()||record.ownerEmail!==env.OWNER_EMAIL.toLowerCase())throw new BudgetError(400,'This connection request expired. Start it from your budget again.');
  const session=await deps.getRecord(env,'session:'+record.sessionId);if(!session||session.expires<Date.now()||session.kind!=='google')throw new BudgetError(401,'Sign in to the primary dashboard account first.');
  const state=deps.random(),auth=new URL('https://accounts.google.com/o/oauth2/v2/auth');
  for(const [k,v] of Object.entries({client_id:env.GOOGLE_CLIENT_ID,redirect_uri:url.origin+'/auth/callback',response_type:'code',scope:'openid email https://www.googleapis.com/auth/gmail.readonly',access_type:'offline',prompt:'select_account consent',state,login_hint:record.expected}))auth.searchParams.set(k,v);
  await deps.putRecord(env,'state:'+await deps.hash(state),{...record,kind:'budget-mail',expires:Date.now()+600000},600);
  return new Response(null,{status:302,headers:{Location:auth.href,'Set-Cookie':`__Host-nest-state=${state}; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=600`,'Cache-Control':'no-store','Referrer-Policy':'no-referrer'}});
}
export async function completeBudgetMail(env,record,result,who,deps) {
  needDb(env);const session=await deps.getRecord(env,'session:'+record.sessionId);
  if(!session||session.expires<Date.now()||session.kind!=='google'||record.owner!==await deps.hash(env.OWNER_EMAIL.toLowerCase()))throw new BudgetError(403,'The primary budget sign-in ended. Reconnect from your budget.');
  if(who.email_verified!==true||who.email?.toLowerCase()!==record.expected)throw new BudgetError(403,'Choose the older Gmail account selected in the budget connection flow.');
  if(!(result.scope||'').split(' ').includes('https://www.googleapis.com/auth/gmail.readonly'))throw new BudgetError(403,'Grant read-only Gmail access for this source.');
  const profile=await deps.provider('https://gmail.googleapis.com/gmail/v1/users/me/profile',{headers:{Authorization:'Bearer '+result.access_token}});
  if(profile.emailAddress?.toLowerCase()!==record.expected)throw new BudgetError(403,'The Gmail mailbox did not match the selected source.');
  const store=new BudgetStore(env.BUDGET_DB,record.owner),settings=await store.get('settings','main');
  if(!settings||settings.generation!==record.generation)throw new BudgetError(409,'The budget was deleted or recreated during consent. Start this connection again.');
  const lock=await store.lock();if(!lock)throw new BudgetError(409,'A budget sync is finishing. Reconnect this source in a moment.');
  try{
  const currentSettings=await store.get('settings','main');if(currentSettings?.generation!==record.generation)throw new BudgetError(409,'The budget changed during consent. Start this connection again.');
  const sourceId=await deps.hash(record.expected),tokenKey='budget:mail:'+record.owner+':'+sourceId,previous=await deps.getRecord(env,tokenKey);
  if(!result.refresh_token&&!previous?.refresh)throw new BudgetError(409,'Offline access was not granted. Reconnect this Gmail source with consent.');
  await deps.putRecord(env,tokenKey,{access:result.access_token,refresh:result.refresh_token||previous.refresh,expires:Date.now()+result.expires_in*1000});
  await store.put('mail-source',sourceId,{id:sourceId,email:record.expected,tokenKey,primary:false,enabled:true});await store.queue('mail',sourceId);
  const nonce=deps.random(),html=`<!doctype html><meta name="viewport" content="width=device-width"><title>Sage budget connection</title><style nonce="${nonce}">body{font:18px system-ui;background:#101c18;color:#eadba2;max-width:600px;margin:10vh auto;padding:24px}a{color:inherit}</style><h1>Gmail source connected</h1><p>Your budget can now discover bills and receipts with read-only access.</p><a href="${env.FRONTEND_ORIGIN}/HomePage/#budgetPanel">Return to your budget</a><script nonce="${nonce}">if(window.opener){window.opener.postMessage({type:'sage-budget-mail-connected'},${JSON.stringify(env.FRONTEND_ORIGIN)});window.close();}</script>`;
  return new Response(html,{headers:{'Content-Type':'text/html;charset=UTF-8','Cache-Control':'no-store','Referrer-Policy':'no-referrer','Set-Cookie':'__Host-nest-state=; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=0','Content-Security-Policy':`default-src 'none'; style-src 'nonce-${nonce}'; script-src 'nonce-${nonce}'; frame-ancestors 'none'; base-uri 'none'`}});
  }finally{await store.unlock(lock);}
}
export async function plaidWebhook(request,env,deps) {
  needDb(env);if(request.method!=='POST')throw new BudgetError(405,'Use POST.');
  const reader=request.body?.getReader();if(!reader)throw new BudgetError(400,'Missing webhook.');let size=0,parts=[];
  try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>65536){await reader.cancel();throw new BudgetError(413,'Webhook too large.');}parts.push(value);}}finally{reader.releaseLock();}
  const raw=new Uint8Array(size);let offset=0;for(const part of parts){raw.set(part,offset);offset+=part.length;}
  if(!await verifyWebhook(raw,request.headers.get('plaid-verification'),async kid=>(await plaidCall(env,'/webhook_verification_key/get',{key_id:kid},deps.boundedJson)).key))throw new BudgetError(401,'Webhook signature could not be verified.');
  let event;try{event=JSON.parse(new TextDecoder().decode(raw));}catch{throw new BudgetError(400,'Invalid webhook JSON.');}
  const owner=await deps.hash(env.OWNER_EMAIL.toLowerCase()),store=new BudgetStore(env.BUDGET_DB,owner),lock=await store.lock();
  if(!lock)throw new BudgetError(503,'Budget sync is busy; retry this webhook.');
  try{
  const digest=await deps.hash(new TextDecoder().decode(raw)),seen=await env.BUDGET_DB.prepare('SELECT digest FROM budget_webhook_receipts WHERE digest=?').bind(digest).first();
  if(seen)return json(env,{accepted:true});
  const item=event.item_id?await store.get('item',event.item_id):null;
  if(item&&item.environment===plaidEnvironment(env)&&item.status!=='disconnected'){
    if(event.webhook_type==='ITEM'&&event.error)await store.put('item',item.id,{...item,status:'needs-attention',error:'Plaid requires attention. Use Reconnect bank.'});
    if(['TRANSACTIONS','ITEM'].includes(event.webhook_type))await store.queue('bank',item.id);
  }
  await env.BUDGET_DB.prepare('INSERT OR IGNORE INTO budget_webhook_receipts(digest,received_at) VALUES(?,?)').bind(digest,Date.now()).run();
  return json(env,{accepted:true},202);
  }finally{await store.unlock(lock);}
}

import {BudgetStore} from './store.mjs';
import {normalizeTransaction,money} from './domain.mjs';
import {parseBudgetMessage,discoveryQuery} from './mail.mjs';
import {plaidCall,BudgetError} from './plaid.mjs';

export function accountRecord(account,item) {
  return {id:account.account_id,itemId:item.id,name:String(account.name||'Bank account').slice(0,100),mask:account.mask||null,type:account.type,subtype:account.subtype||null,currentCents:money(account.balances?.current),availableCents:money(account.balances?.available),currency:account.balances?.iso_currency_code||null,environment:item.environment,balanceAt:account.balances?.last_updated_datetime||item.providerUpdatedAt||null,balanceRetrievedAt:new Date().toISOString(),balanceSource:'provider-cached',included:account.type==='depository'};
}
export async function storeAccounts(store,accounts,item,source='provider-cached') {
  const writes=[];
  for(const account of accounts){const previous=await store.get('account',account.account_id),row=accountRecord(account,item);if(previous)row.included=previous.included;row.balanceSource=source;if(source==='on-demand')row.balanceAt=row.balanceRetrievedAt;writes.push(store.putStatement('account',row.id,row));}
  if(writes.length)await store.db.batch(writes);
}
async function commitBankPage(store,job,item,state,page) {
  const writes=[];
  for(const raw of [...page.added,...page.modified]){
    const transaction={...normalizeTransaction(raw,item.environment),itemId:item.id,sourceId:item.id};
    writes.push(store.statement('INSERT INTO budget_sync_stage(owner_id,source_id,generation,id,operation,data) VALUES(?,?,?,?,?,?) ON CONFLICT(owner_id,source_id,generation,id) DO UPDATE SET operation=excluded.operation,data=excluded.data',store.owner,item.id,state.generation,transaction.id,'upsert',JSON.stringify(transaction)));
  }
  for(const raw of page.removed)writes.push(store.statement('INSERT INTO budget_sync_stage(owner_id,source_id,generation,id,operation,data) VALUES(?,?,?,?,?,?) ON CONFLICT(owner_id,source_id,generation,id) DO UPDATE SET operation=excluded.operation,data=excluded.data',store.owner,item.id,state.generation,raw.transaction_id,'remove','{}'));
  // Staging is not visible to financial summaries. Save each whole page and its
  // next cursor together, so a failed request resumes without partial totals.
  state.nextCursor=page.next_cursor;
  writes.push(store.statement('UPDATE budget_jobs SET state=? WHERE owner_id=? AND id=? AND lease_id=?',JSON.stringify(state),store.owner,job.id,job.lease_id));
  await store.db.batch(writes);
}
export async function promoteBankSync(store,item,state) {
  const now=new Date().toISOString(),where='owner_id=? AND source_id=? AND generation=?',args=[store.owner,item.id,state.generation];
  item.cursor=state.nextCursor;item.lastSync=now;item.error=null;item.status='connected';
  const accountWrites=[];for(const account of state.accounts||[]){const previous=await store.get('account',account.account_id),row=accountRecord(account,item);if(previous)row.included=previous.included;accountWrites.push(store.putStatement('account',row.id,row));}
  await store.db.batch([
    store.statement(`INSERT INTO budget_records(owner_id,kind,id,data,updated_at) SELECT a.owner_id,'annotation',s.id,json_set(a.data,'$.id',s.id),? FROM budget_sync_stage s JOIN budget_records a ON a.owner_id=s.owner_id AND a.kind='annotation' AND a.id=json_extract(s.data,'$.pendingId') WHERE s.owner_id=? AND s.source_id=? AND s.generation=? AND s.operation='upsert' ON CONFLICT(owner_id,kind,id) DO NOTHING`,now,...args),
    store.statement(`DELETE FROM budget_records WHERE owner_id=? AND kind='annotation' AND id IN (SELECT json_extract(data,'$.pendingId') FROM budget_sync_stage WHERE ${where} AND operation='upsert' AND json_extract(data,'$.pendingId') IS NOT NULL)`,store.owner,...args),
    store.statement(`DELETE FROM budget_records WHERE owner_id=? AND kind='transaction' AND id IN (SELECT json_extract(data,'$.pendingId') FROM budget_sync_stage WHERE ${where} AND operation='upsert' AND json_extract(data,'$.pendingId') IS NOT NULL)`,store.owner,...args),
    store.statement(`DELETE FROM budget_records WHERE owner_id=? AND kind='transaction' AND id IN (SELECT id FROM budget_sync_stage WHERE ${where} AND operation='remove')`,store.owner,...args),
    store.statement(`INSERT INTO budget_records(owner_id,kind,id,data,updated_at) SELECT owner_id,'transaction',id,data,? FROM budget_sync_stage s WHERE ${where} AND operation='upsert' AND NOT EXISTS (SELECT 1 FROM budget_sync_stage p WHERE p.owner_id=s.owner_id AND p.source_id=s.source_id AND p.generation=s.generation AND p.operation='upsert' AND json_extract(p.data,'$.pendingId')=s.id) ON CONFLICT(owner_id,kind,id) DO UPDATE SET data=excluded.data,updated_at=excluded.updated_at`,now,...args),
    ...accountWrites,store.putStatement('item',item.id,item),
    store.statement(`DELETE FROM budget_sync_stage WHERE ${where}`,...args)
  ]);
}
async function bankSync(store,job,env,deps) {
  const item=await store.get('item',job.source_id);if(!item||item.status==='disconnecting')return {complete:true,state:{}};
  const token=await deps.getRecord(env,item.tokenKey);if(!token?.access)throw new BudgetError(409,'Reconnect the bank to resume syncing.','ITEM_LOGIN_REQUIRED');
  const state=JSON.parse(job.state||'{}');if(!state.generation){state.generation=crypto.randomUUID();state.startCursor=item.cursor||null;state.nextCursor=item.cursor||null;}
  for(let i=0;i<2;i++){
    let page;
    try{page=await plaidCall(env,'/transactions/sync',{access_token:token.access,cursor:state.nextCursor,count:100,options:{include_original_description:false}},deps.boundedJson);}
    catch(error){
      if(error.code==='TRANSACTIONS_SYNC_MUTATION_DURING_PAGINATION'){
        await store.statement('DELETE FROM budget_sync_stage WHERE owner_id=? AND source_id=? AND generation=?',store.owner,item.id,state.generation).run();
        return {complete:false,state:{},error:error.message,delay:60000};
      }
      throw error;
    }
    if(!Array.isArray(page.added)||!Array.isArray(page.modified)||!Array.isArray(page.removed)||typeof page.has_more!=='boolean'||typeof page.next_cursor!=='string')throw new BudgetError(502,'Plaid returned an incomplete sync page. Previous data is retained.');
    item.historyStatus=page.transactions_update_status||'TRANSACTIONS_UPDATE_STATUS_UNKNOWN';
    if(Array.isArray(page.accounts)){const accounts=new Map((state.accounts||[]).map(a=>[a.account_id,a]));for(const account of page.accounts)accounts.set(account.account_id,account);state.accounts=[...accounts.values()];}
    await commitBankPage(store,job,item,state,page);
    if(!page.has_more){
      const details=await plaidCall(env,'/item/get',{access_token:token.access},deps.boundedJson);item.providerUpdatedAt=details.status?.transactions?.last_successful_update||details.item?.status?.transactions?.last_successful_update||null;
      await promoteBankSync(store,item,state);return {complete:true,state:{}};
    }
  }
  return {complete:false,state};
}
async function googleRead(env,source,path,deps) {
  let token;
  if(source.primary)token=await deps.access(env,'google');
  else{
    const stored=await deps.getRecord(env,source.tokenKey);
    if(!stored)throw new BudgetError(409,'Reconnect this Gmail source to continue.','MAIL_RECONNECT');
    if(stored.expires<Date.now()+60000){
      const result=await deps.exchange(env,{grant_type:'refresh_token',refresh_token:stored.refresh});stored.access=result.access_token;stored.expires=Date.now()+result.expires_in*1000;if(result.refresh_token)stored.refresh=result.refresh_token;await deps.putRecord(env,source.tokenKey,stored);
    }
    token=stored.access;
  }
  return deps.provider('https://gmail.googleapis.com/gmail/v1/users/me/'+path,{headers:{Authorization:'Bearer '+token}},1048576);
}
async function incorporateObservation(store,observation) {
  await store.put('observation',observation.id,observation);
  const bill=await store.get('bill',observation.merchantId);if(!bill)return;
  if(observation.kind==='cancellation'){
    await store.put('proposal',observation.id,{...observation,reason:'Cancellation notice found. Confirm the effective end date before removing this commitment.'});return;
  }
  if(['receipt','bill','notice'].includes(observation.kind)&&observation.currency==='USD'&&observation.frequency&&observation.amountCents>0&&!observation.conflicts.length&&!bill.manual){
    const updated={...bill,amountCents:observation.amountCents,frequency:observation.frequency,status:'active',certainty:'email-confirmed',sourceId:observation.sourceId,sourceUrl:observation.sourceUrl,lastEvidenceAt:observation.receivedAt};
    if(observation.serviceName)updated.name=observation.serviceName;
    if(observation.dueDate){updated.nextDate=observation.dueDate;if(updated.frequency==='monthly')updated.day=Number(observation.dueDate.slice(8));}
    if(bill.amountCents!==null&&bill.amountCents!==observation.amountCents){await store.put('proposal',observation.id,{...observation,reason:'Observed amount differs from the saved commitment. Confirm a price change.'});}
    else if(!bill.lastEvidenceAt||bill.lastEvidenceAt<observation.receivedAt)await store.put('bill',bill.id,updated);
  }
  if(observation.dueDate&&observation.amountCents>=0&&observation.currency==='USD'&&!observation.conflicts.length){
    const event={id:bill.id+':'+observation.dueDate,billId:bill.id,name:bill.name,merchantId:bill.merchantId,category:bill.category,date:observation.dueDate,contractualDueDate:observation.dueDate,amountCents:observation.amountCents,certainty:'email-confirmed',paymentStatus:observation.paymentStatus,source:'email',sourceId:observation.sourceId,sourceUrl:observation.sourceUrl,observationId:observation.id,receivedAt:observation.receivedAt,subscription:!!bill.subscription};
    const previous=await store.get('event',event.id);
    if(!previous||previous.receivedAt<event.receivedAt)await store.put('event',event.id,event);
    if(previous&&previous.amountCents!==event.amountCents)await store.put('proposal',observation.id,{...observation,reason:'Conflicting invoice amounts for the same due date.'});
  }
}
async function mailSync(store,job,env,deps) {
  const source=await store.get('mail-source',job.source_id);if(!source?.enabled)return {complete:true,state:{}};
  const state=JSON.parse(job.state||'{}'),now=Math.floor(Date.now()/1000);
  if(!state.before){state.before=now;state.after=source.completedThrough?Math.max(now-366*86400,source.completedThrough-2*86400):now-366*86400;state.pageToken=null;state.processed=0;}
  const params=new URLSearchParams({q:discoveryQuery(state.after,state.before),maxResults:'15'});if(state.pageToken)params.set('pageToken',state.pageToken);
  let page;
  try{page=await googleRead(env,source,'messages?'+params,deps);}catch(error){if(error.status===502&&state.pageToken){state.pageToken=null;return {complete:false,state,error:'Gmail pagination changed; restarting this scan window safely.',delay:60000};}throw error;}
  for(const message of page.messages||[]){
    const raw=await googleRead(env,source,'messages/'+encodeURIComponent(message.id)+'?format=full',deps),observation=parseBudgetMessage(raw,source.email,source.id);
    if(observation)await incorporateObservation(store,observation);state.processed++;
  }
  state.pageToken=page.nextPageToken||null;source.processedCount=(source.processedCount||0)+(page.messages||[]).length;source.lastBatchAt=new Date().toISOString();source.error=null;
  if(!state.pageToken){source.completedThrough=state.before;source.lastSync=new Date().toISOString();source.backfillComplete=true;}
  await store.put('mail-source',source.id,source);
  return {complete:!state.pageToken,state:state.pageToken?state:{}};
}
export async function runBudgetJob(env,owner,id,deps) {
  const store=new BudgetStore(env.BUDGET_DB,owner),lock=await store.lock();if(!lock)return {busy:true};
  const job=await store.lease(id);if(!job){await store.unlock(lock);return {busy:true};}
  try{
    const result=job.kind==='bank'?await bankSync(store,job,env,deps):await mailSync(store,job,env,deps);
    await store.finish(job,result.state,result);return {busy:false,complete:result.complete,error:result.error||null};
  }catch(error){
    const state=await store.statement('SELECT state FROM budget_jobs WHERE owner_id=? AND id=?',owner,job.id).first();
    const message=error instanceof BudgetError?error.message:error.status===401?'Google authorization expired. Reconnect the affected Gmail source.':'Sync failed. Previously synced data is retained; retry later.';
    await store.finish(job,JSON.parse(state?.state||job.state||'{}'),{error:message,delay:error.status===429?15*60000:5*60000});
    const kind=job.kind==='bank'?'item':'mail-source',source=await store.get(kind,job.source_id);
    if(source)await store.put(kind,source.id,{...source,error:message,status:'needs-attention'});
    return {complete:false,error:message};
  }finally{await store.unlock(lock);}
}
export async function scheduledBudget(env,deps) {
  if(!env.BUDGET_DB)return;
  const owner=await deps.hash(env.OWNER_EMAIL.toLowerCase());
  const next=await env.BUDGET_DB.prepare('SELECT id FROM budget_jobs WHERE owner_id=? AND next_run<=? AND lease_until<? ORDER BY next_run,updated_at LIMIT 1').bind(owner,Date.now(),Date.now()).first();
  if(next)await runBudgetJob(env,owner,next.id,deps);
  await env.BUDGET_DB.prepare('DELETE FROM budget_webhook_receipts WHERE received_at<?').bind(Date.now()-86400000).run();
}

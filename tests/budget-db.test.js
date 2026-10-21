import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {BudgetStore} from '../nest-service/budget/store.mjs';
import {runBudgetJob,scheduledBudget} from '../nest-service/budget/sync.mjs';
import {ensureBudgetReadIndexes,READ_INDEXES} from '../nest-service/budget/read-indexes.mjs';
import {handleBudget,snapshot,completeBudgetMail,plaidWebhook} from '../nest-service/budget/handler.mjs';
import gateway,{boundedJson} from '../nest-service/worker.mjs';
import {importCsv} from '../nest-service/budget/csv.mjs';
import {mapCsvRows,parseCsv} from '../js/bank-csv.mjs';

// Exercise the actual parameterized SQL and atomic transactions against SQLite.
function database(){
  const sql=new DatabaseSync(':memory:');sql.exec(readFileSync(new URL('../nest-service/migrations/0001_budget.sql',import.meta.url),'utf8'));sql.exec(readFileSync(new URL('../nest-service/migrations/0002_budget_demand_reads.sql',import.meta.url),'utf8'));
  const db={prepare(query){return {values:[],bind(...values){this.values=values;return this;},async first(column){const row=sql.prepare(query).get(...this.values);return column?row?.[column]??null:row??null;},async all(){return {results:sql.prepare(query).all(...this.values)};},async run(){const result=sql.prepare(query).run(...this.values);return {meta:{changes:Number(result.changes)}};}};},async batch(statements){sql.exec('BEGIN');try{const results=[];for(const statement of statements)results.push(await statement.run());sql.exec('COMMIT');return results;}catch(error){sql.exec('ROLLBACK');throw error;}},close(){sql.close();}};return db;
}
function fixture(t){const db=database();t.after(()=>db.close());const records=new Map(),env={BUDGET_DB:db,OWNER_EMAIL:'owner@example.com',FRONTEND_ORIGIN:'https://dashboard.test',PLAID_ENV:'sandbox',PLAID_CLIENT_ID:'test-client',PLAID_SECRET:'test-secret',NEST_KV:{get:async k=>records.get(k)||null,put:async(k,v)=>records.set(k,v),delete:async k=>records.delete(k)}};const deps={boundedJson,getRecord:async(e,k)=>records.get(k)||null,putRecord:async(e,k,v)=>records.set(k,v),hash:async s=>Buffer.from(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s))).toString('hex'),access:async()=> 'google-test-access'};return {db,env,deps,records,store:new BudgetStore(db,'owner')};}
const post=(path,body)=>new Request('https://gateway.test/budget'+path,{method:'POST',headers:{'Content-Type':'application/json','X-Budget-Mode':'on-demand-v1'},body:JSON.stringify(body)});
const tx=(id,extra={})=>({transaction_id:id,account_id:'account',name:'Socket Internet',amount:25,date:'2026-10-15',iso_currency_code:'USD',...extra});
const page=(added,next_cursor,has_more=false,extra={})=>({added,modified:[],removed:[],next_cursor,has_more,transactions_update_status:'HISTORICAL_UPDATE_COMPLETE',...extra});

test('a selected-period snapshot uses index seeks with a large unrelated history',async t=>{
 const f=fixture(t);await f.store.initialize();
 const old=Array.from({length:20000},(_,i)=>({id:'old'+i,date:'1999-01-01',environment:'production',amountCents:100,classification:'purchase',currency:'USD'}));
 await f.db.prepare("INSERT INTO budget_records SELECT ?, 'transaction',json_extract(value,'$.id'),value,? FROM json_each(?)").bind('owner',new Date().toISOString(),JSON.stringify(old)).run();
 await f.store.put('transaction','selected',{date:'2000-01-05',environment:'production',amountCents:200,currency:'USD',classification:'purchase'});
 await f.store.put('transaction','pending',{date:'2000-01-05',pending:true,environment:'production',amountCents:900,currency:'USD',classification:'purchase'});
 await f.store.put('transaction','later-posted',{date:'2000-02-01',pendingId:'pending',environment:'production',amountCents:900,currency:'USD',classification:'purchase'});
 const queries=[],statement=f.store.statement.bind(f.store);t.mock.method(f.store,'statement',(query,...values)=>{if(query.startsWith('SELECT'))queries.push({query,values});return statement(query,...values);});
 const result=await snapshot(f.store,f.env,new URL('https://gateway.test/budget/snapshot?activityStart=2000-01-01&activityEnd=2000-01-07'));
 assert.equal(result.transactionCount,1);assert.equal(result.activity.amountCents,200);assert.equal(result.summary.spending.amountCents,200);
 const plans=[];for(const {query,values} of queries){const {results}=await f.db.prepare('EXPLAIN QUERY PLAN '+query).bind(...values).all();const detail=results.map(r=>r.detail);plans.push(...detail);if(query.includes('FROM budget_records'))assert.ok(detail.every(p=>!p.includes('TEMP B-TREE')),detail.join('\n'));}
 assert.ok(plans.some(p=>p.includes('budget_dates')));assert.ok(plans.some(p=>p.includes('budget_pending_replacements')&&p.includes('<expr>=?')));assert.ok(plans.some(p=>p.includes('budget_record_lists')));assert.ok(plans.some(p=>p.includes('budget_live_history')));
 assert.ok(plans.every(p=>!/^SCAN (?:budget_records|posted)\b/.test(p)),plans.join('\n'));
});

test('the quota-reset fallback installs missing read indexes once, without timers or repeated DDL',async t=>{
 const f=fixture(t);let batches=0;const batch=f.db.batch.bind(f.db);t.mock.method(f.db,'batch',statements=>{batches++;assert.equal(statements.length,READ_INDEXES.length);return batch(statements);});
 await ensureBudgetReadIndexes(f.db);assert.equal(batches,0);
 for(const [name] of READ_INDEXES)await f.db.prepare('DROP INDEX '+name).run();
 await ensureBudgetReadIndexes(f.db);assert.equal(batches,1);await ensureBudgetReadIndexes(f.db);assert.equal(batches,1);
 t.mock.method(f.db,'prepare',()=>{throw Error('D1 daily allowance exhausted');});
 await assert.rejects(ensureBudgetReadIndexes(f.db),/daily allowance/);assert.equal(batches,1);
});

test('date-filtered bank import pages are bounded and atomic, preserving other periods and corrections',async t=>{
 const f=fixture(t);await bank(f);const range={start:'2026-10-01',end:'2026-10-20'};
 await f.store.put('transaction','older',{date:'2026-09-01',itemId:'bank',amountCents:50});
 await f.store.put('transaction','old-in-period',{date:'2026-10-01',itemId:'bank',amountCents:75});
 await f.store.put('transaction','other-bank',{date:'2026-10-01',itemId:'other',amountCents:60});
 await f.store.put('annotation','pending',{category:'Corrected',classification:'transfer'});
 const rows=Array.from({length:201},(_,i)=>tx('row'+i));rows[0]=tx('pending',{pending:true});rows[200]=tx('posted',{pending_transaction_id:'pending'});const calls=[];
 t.mock.method(globalThis,'fetch',async(url,options)=>{assert.equal(new URL(url).pathname,'/transactions/get');const input=JSON.parse(options.body);calls.push(input);assert.equal(input.start_date,range.start);assert.equal(input.end_date,range.end);assert.equal(input.options.count,100);assert.equal(input.cursor,undefined);return Response.json({transactions:rows.slice(input.options.offset,input.options.offset+100),total_transactions:rows.length,accounts:[]});});
 assert.equal((await runBudgetJob(f.env,'owner','bank:bank',f.deps,range)).complete,false);assert.equal(calls.length,2);assert.ok(await f.store.get('transaction','old-in-period'));assert.equal(await f.store.get('transaction','row1'),null);
 assert.equal((await runBudgetJob(f.env,'owner','bank:bank',f.deps,range)).complete,true);assert.deepEqual(calls.map(c=>c.options.offset),[0,100,200]);
 assert.ok(await f.store.get('transaction','older'));assert.ok(await f.store.get('transaction','other-bank'));assert.equal(await f.store.get('transaction','old-in-period'),null);assert.equal(await f.store.get('transaction','pending'),null);assert.equal((await f.store.get('annotation','posted')).category,'Corrected');assert.equal((await f.store.get('item','bank')).cursor,'saved');assert.deepEqual((await f.store.get('item','bank')).lastRange,range);
});

test('bank range changes discard only staging and never replace saved history with an incomplete page',async t=>{
 const f=fixture(t);await bank(f);await f.store.put('transaction','saved',{date:'2026-10-02',itemId:'bank',amountCents:123});let call=0;
 t.mock.method(globalThis,'fetch',async(url,options)=>{const input=JSON.parse(options.body);call++;return Response.json({transactions:call<=2?Array.from({length:100},(_,i)=>tx('stage'+input.options.offset+'-'+i)):[],total_transactions:500,accounts:[]});});
 await runBudgetJob(f.env,'owner','bank:bank',f.deps,{start:'2026-10-01',end:'2026-10-20'});assert.equal(await f.db.prepare('SELECT count(*) AS count FROM budget_sync_stage').first('count'),200);
 const next=await runBudgetJob(f.env,'owner','bank:bank',f.deps,{start:'2026-09-01',end:'2026-09-30'});assert.match(next.error,/incomplete/);assert.equal(await f.db.prepare('SELECT count(*) AS count FROM budget_sync_stage').first('count'),0);assert.equal((await f.store.get('transaction','saved')).amountCents,123);
});

test('explicit Gmail imports query only the selected Chicago dates',async t=>{
 const f=fixture(t);await f.store.put('mail-source','mail',{id:'mail',email:'owner@example.com',enabled:true,primary:true});await f.store.queue('mail','mail');
 const range={start:'2026-10-01',end:'2026-10-20'},urls=[];
 f.deps.provider=async url=>{urls.push(url);return {messages:[]};};
 const result=await runBudgetJob(f.env,'owner','mail:mail',f.deps,range);assert.equal(result.complete,true);assert.equal(urls.length,1);
 const url=new URL(urls[0]);assert.equal(url.searchParams.get('maxResults'),'15');assert.match(url.searchParams.get('q'),/after:1790830800 before:1792558800/);assert.deepEqual((await f.store.get('mail-source','mail')).lastRange,range);
});

test('explicit period sync finishes all queued sources without reloading snapshots between batches',async t=>{
 const f=fixture(t);await bank(f);await f.store.put('mail-source','mail',{id:'mail',email:'owner@example.com',enabled:true,primary:true});await f.store.queue('mail','mail');
 const range={activityStart:'2026-10-01',activityEnd:'2026-10-20'};let bankCalls=0,mailCalls=0;
 t.mock.method(globalThis,'fetch',async()=>{bankCalls++;return Response.json({transactions:[],total_transactions:0,accounts:[]});});f.deps.provider=async()=>{mailCalls++;return {messages:[]};};
 assert.equal((await (await handleBudget(post('/sync',range),f.env,'owner','session',f.deps)).json()).complete,false);
 assert.equal((await (await handleBudget(post('/sync',range),f.env,'owner','session',f.deps)).json()).complete,true);assert.equal(bankCalls,1);assert.equal(mailCalls,1);
 assert.ok((await f.store.jobs()).every(j=>j.status==='idle'));
});

test('production preserves Sandbox history without sending its tokens to production or queueing new test syncs',async t=>{
 const f=fixture(t);await bank(f);await f.store.put('transaction','test-history',{date:'2026-10-15',environment:'sandbox',itemId:'bank',amountCents:100});f.env.PLAID_ENV='production';
 t.mock.method(globalThis,'fetch',()=>{throw Error('Sandbox token reached production');});
 assert.equal((await runBudgetJob(f.env,'owner','bank:bank',f.deps,{start:'2026-10-01',end:'2026-10-20'})).complete,true);assert.ok(await f.store.get('transaction','test-history'));
 for(const path of ['/balances','/link-updated'])await assert.rejects(handleBudget(post(path,{itemId:'bank'}),f.env,'owner','session',f.deps),error=>error.code==='BANK_ENVIRONMENT');
 await f.db.prepare('DELETE FROM budget_jobs').run();await handleBudget(post('/sync/queue',{}),f.env,'owner','session',f.deps);assert.equal((await f.store.jobs()).length,0);
});

test('a maximum-size CSV import uses three atomic statements with bounded parameter counts',async t=>{
 const f=fixture(t);await f.store.initialize();const batch=f.db.batch.bind(f.db);
 t.mock.method(f.db,'batch',statements=>{assert.equal(statements.length,3);assert.ok(statements.every(s=>s.values.length<=5));return batch(statements);});
 const rows=Array.from({length:500},(_,i)=>({date:'2000-01-01',description:'Synthetic store '+i,signedCents:-101,classification:'purchase'}));
 const result=await importCsv(f.store,{accountLabel:'Synthetic maximum',confirmation:'IMPORT CSV',rows});
 assert.equal(result.added,500);assert.equal((await f.store.list('transaction')).length,500);
});

test('retired polling clients are rejected before any D1 read, including valid signed-in sessions',async t=>{
 const f=fixture(t);Object.assign(f.env,{TOKEN_ENCRYPTION_KEY:Buffer.alloc(32,7).toString('base64'),GOOGLE_CLIENT_ID:'test',GOOGLE_CLIENT_SECRET:'test'});const token='c'.repeat(64);
 await encryptedSession(f.env,token,{kind:'google',ownerEmail:f.env.OWNER_EMAIL,expires:Date.now()+86400000});let calls=0;
 t.mock.method(f.db,'prepare',()=>{calls++;throw Error('Retired client touched D1');});
 for(const [path,method] of [['snapshot','GET'],['transactions','GET'],['sync','POST']]){
  const response=await gateway.fetch(new Request('https://gateway.test/budget/'+path,{method,headers:{Origin:f.env.FRONTEND_ORIGIN,Authorization:'Bearer '+token,'Content-Type':'application/json'},...(method==='POST'?{body:'{}'}:{})}),f.env);
  assert.equal(response.status,409);assert.equal((await response.json()).code,'BUDGET_CLIENT_RELOAD');
 }
 assert.equal(calls,0);
});

test('an exhausted D1 daily allowance returns a safe retryable status without losing the Google session',async t=>{
 const f=fixture(t);Object.assign(f.env,{TOKEN_ENCRYPTION_KEY:Buffer.alloc(32,7).toString('base64'),GOOGLE_CLIENT_ID:'test',GOOGLE_CLIENT_SECRET:'test'});const token='a'.repeat(64);
 await encryptedSession(f.env,token,{kind:'google',ownerEmail:f.env.OWNER_EMAIL,expires:Date.now()+86400000});
 t.mock.method(f.db,'prepare',()=>{throw Error('D1_ERROR: D1 DB exceeded its daily free operations limit.');});
 const r=await gateway.fetch(new Request('https://gateway.test/budget/snapshot',{headers:{Origin:f.env.FRONTEND_ORIGIN,Authorization:'Bearer '+token,'X-Budget-Mode':'on-demand-v1'}}),f.env);
 assert.equal(r.status,503);assert.ok(Number(r.headers.get('Retry-After'))>0&&Number(r.headers.get('Retry-After'))<=86400);
 const body=await r.json();assert.equal(body.code,'DATABASE_DAILY_LIMIT');assert.match(body.error,/Saved records are unchanged/);assert.match(body.error,/00:00 UTC/);
 assert.equal(f.records.size,1);
});

test('date-filtered snapshots aggregate before pagination, limit review evidence and leave saved records unchanged',async t=>{
 const f=fixture(t);await f.store.initialize();
 for(let i=0;i<80;i++)await f.store.put('transaction','prod-'+i,{id:'prod-'+i,date:i<60?'2000-01-05':'1999-12-28',environment:'production',currency:'USD',classification:'purchase',amountCents:100,merchant:'Test merchant',category:'Food'});
 const row=(id,extra)=>f.store.put('transaction',id,{id,date:'2000-01-05',environment:'production',currency:'USD',classification:'purchase',amountCents:100,...extra});
 await row('sandbox',{environment:'sandbox',amountCents:999999});await row('pending',{pending:true,amountCents:700});await row('posted',{pendingId:'pending',amountCents:700});await row('refund',{amountCents:-200});await row('transfer',{classification:'transfer',amountCents:50000});await row('foreign',{currency:'EUR'});await row('older-review',{date:'1999-12-01',classification:'review'});
 const count=async()=>f.db.prepare('SELECT count(*) AS count FROM budget_records').first('count'),before=await count();
 const original=await snapshot(f.store,f.env,new URL('https://gateway.test/budget/snapshot'));
 const query='https://gateway.test/budget/snapshot?activityStart=2000-01-01&activityEnd=2000-01-07';
 const first=await snapshot(f.store,f.env,new URL(query)),second=await snapshot(f.store,f.env,new URL(query+'&transactionPage=1'));
 assert.equal(first.activity.amountCents,6500);assert.equal(first.activity.refundsCents,200);assert.equal(first.transactionCount,65);
 assert.equal(first.transactions.length,50);assert.equal(second.transactions.length,15);assert.deepEqual(first.activity,second.activity);
 for(const key of ['availableCents','currentCents','cashAccountCount','monthlyCommitments','annualRenewals','window'])assert.deepEqual(first.summary[key],original.summary[key]);
 assert.equal(first.summary.spending.amountCents,6500);assert.equal(first.summary.spending.start,'2000-01-01');assert.equal(first.summary.spending.end,'2000-01-07');
 assert.equal(await count(),before);assert.ok(!first.reviewTransactions.some(t=>t.id==='older-review'));assert.equal(original.transactionCount,0);
 await assert.rejects(snapshot(f.store,f.env,new URL(query+'&activityStart=2000-01-02')),/valid historical date range/);
});
async function bank(f){const item={id:'bank',tokenKey:'bank-token',environment:'sandbox',cursor:'saved',status:'connected'};await f.store.put('item',item.id,item);f.records.set(item.tokenKey,{access:'private-bank-token'});await f.store.queue('bank',item.id);return item;}

test('D1 owner predicates isolate records, leases, jobs and deletion',async t=>{
  const f=fixture(t),other=new BudgetStore(f.db,'other');await f.store.initialize();await other.initialize();await f.store.put('transaction','same',{sourceId:'bank',amountCents:100});await other.put('transaction','same',{sourceId:'bank',amountCents:999});
  assert.equal((await f.store.get('transaction','same')).amountCents,100);const lock=await f.store.lock();assert.ok(lock);assert.equal(await f.store.lock(),null);assert.ok(await other.lock());await f.store.unlock('wrong');assert.equal(await f.store.lock(),null);await f.store.unlock(lock);
  await f.store.deleteSource('bank','bank');assert.equal(await f.store.get('transaction','same'),null);assert.equal((await other.get('transaction','same')).amountCents,999);
});
test('paginated bank sync is invisible until atomic promotion and pending corrections survive',async t=>{
  const f=fixture(t);await bank(f);await f.store.put('transaction','old',{id:'old',amountCents:99});await f.store.put('annotation','pending',{id:'pending',category:'Corrected',classification:'transfer'});
  const pages=[page([tx('pending',{pending:true})],'page1',true),page([tx('posted',{pending_transaction_id:'pending'})],'page2',true),page([],'done',false,{removed:[{transaction_id:'old'}]})],cursors=[];
  t.mock.method(globalThis,'fetch',async(url,options)=>{assert.equal(options.redirect,'manual');cursors.push(JSON.parse(options.body).cursor);return Response.json(new URL(url).pathname==='/item/get'?{status:{transactions:{last_successful_update:new Date().toISOString()}}}:pages.shift());});
  assert.equal((await runBudgetJob(f.env,'owner','bank:bank',f.deps)).complete,false);assert.deepEqual((await f.store.list('transaction')).map(t=>t.id),['old']);assert.equal((await f.store.get('item','bank')).cursor,'saved');
  assert.equal((await runBudgetJob(f.env,'owner','bank:bank',f.deps)).complete,true);assert.deepEqual((await f.store.list('transaction')).map(t=>t.id),['posted']);assert.equal((await f.store.get('annotation','posted')).category,'Corrected');assert.equal(await f.store.get('annotation','pending'),null);assert.deepEqual(cursors.filter(Boolean),['saved','page1','page2']);assert.equal((await f.store.get('item','bank')).cursor,'done');
});
test('bank mutation restarts from committed cursor and rate limits preserve data and backoff',async t=>{
  const f=fixture(t);await bank(f);await f.store.put('transaction','retained',{amountCents:123});let calls=0;const cursors=[];
  t.mock.method(globalThis,'fetch',async(url,options)=>{cursors.push(JSON.parse(options.body).cursor);calls++;return calls===1?Response.json(page([tx('uncommitted')],'partial',true)):Response.json({error_code:'TRANSACTIONS_SYNC_MUTATION_DURING_PAGINATION'},{status:400});});
  await runBudgetJob(f.env,'owner','bank:bank',f.deps);assert.equal((await f.store.get('item','bank')).cursor,'saved');assert.equal((await f.store.list('transaction')).length,1);assert.equal((await f.db.prepare('SELECT count(*) AS count FROM budget_sync_stage').first()).count,0);
  await f.db.prepare('UPDATE budget_jobs SET next_run=0').run();t.mock.restoreAll();t.mock.method(globalThis,'fetch',async(url,options)=>{cursors.push(JSON.parse(options.body).cursor);return Response.json({error_code:'RATE_LIMIT_EXCEEDED',error_message:'secret should never escape'},{status:429});});
  const result=await runBudgetJob(f.env,'owner','bank:bank',f.deps);assert.match(result.error,/rate limiting/);assert.ok(!JSON.stringify(result).includes('secret'));assert.equal(cursors.at(-1),'saved');assert.ok((await f.store.jobs())[0].next_run>Date.now()+14*60000);assert.deepEqual(await runBudgetJob(f.env,'owner','bank:bank',f.deps),{busy:true});assert.equal((await f.store.list('transaction')).length,1);
});
test('mail backfill uses bounded read-only pages, remains idempotent, and preserves manual bills',async t=>{
  const f=fixture(t);await f.store.initialize();await f.store.put('bill','socket',{id:'socket',name:'Socket',merchantId:'socket',amountCents:8800,frequency:'monthly',manual:true});await f.store.put('mail-source','mail',{id:'mail',email:'owner@example.com',enabled:true,primary:true});await f.store.queue('mail','mail');const urls=[];
  f.deps.provider=async(url,options)=>{urls.push(url);assert.equal(options.method,undefined);if(url.includes('/messages?'))return {messages:[{id:'abcdef1234'}]};return {id:'abcdef1234',internalDate:String(Date.now()),payload:{headers:[{name:'From',value:'billing@socket.net'},{name:'Subject',value:'Socket bill'}],mimeType:'text/plain',body:{data:Buffer.from('Amount due: $72.50. Due date: October 25, 2026. Billed monthly.').toString('base64url')}}};};
  await runBudgetJob(f.env,'owner','mail:mail',f.deps);assert.equal((await f.store.list('observation')).length,1);assert.equal((await f.store.get('bill','socket')).amountCents,8800);assert.equal((await f.store.get('mail-source','mail')).backfillComplete,true);assert.ok(urls.every(u=>!/send|modify|trash|delete/.test(u)));assert.match(urls[0],/maxResults=15/);
  await f.store.queue('mail','mail');await runBudgetJob(f.env,'owner','mail:mail',f.deps);assert.equal((await f.store.list('observation')).length,1);assert.equal((await f.store.list('event')).length,1);assert.ok(!JSON.stringify(await f.store.list('observation')).includes('Amount due: $72.50. Due date'));
});
test('field corrections change materialized bills and snapshot applies categories and older review evidence',async t=>{
  const f=fixture(t);await f.store.initialize();await f.store.put('observation','receipt',{sourceId:'mail',merchantId:'socket',currency:'USD',kind:'invoice',paymentStatus:'unpaid',dueDate:'2026-10-20',amountCents:100});await f.store.put('event','socket:2026-10-20',{observationId:'receipt',sourceId:'mail'});
  await handleBudget(post('/observation',{id:'receipt',amount:'77.00',dueDate:'2026-10-27',frequency:'monthly'}),f.env,'owner','session',f.deps);assert.equal(await f.store.get('event','socket:2026-10-20'),null);assert.equal((await f.store.get('event','socket:2026-10-27')).amountCents,7700);
  await f.store.put('transaction','tx',{date:'2026-10-15',merchantId:'paypal',classification:'review',amountCents:100,currency:'USD',environment:'production'});await handleBudget(post('/transaction',{id:'tx',category:'Food',classification:'purchase'}),f.env,'owner','session',f.deps);const result=await snapshot(f.store,f.env,new URL('https://gateway.test/budget/snapshot'));assert.equal(result.transactions[0].category,'Food');assert.ok(!result.summary.review.some(r=>r.transactionId==='tx'));assert.ok(!JSON.stringify(result).includes('bank-token'));
});
test('source purge removes corrections and linked matches while keeping unrelated and manual records',async t=>{
  const f=fixture(t);await f.store.initialize();await f.store.put('transaction','tx',{itemId:'bank'});await f.store.put('annotation','tx',{amountCents:999});await f.store.put('observation','obs',{sourceId:'mail'});await f.store.put('match-override','obs',{transactionIds:['tx']});await f.store.put('bill','socket',{id:'socket',sourceId:'mail',amountCents:999});await f.store.deleteSource('bank','bank');assert.equal(await f.store.get('annotation','tx'),null);assert.equal(await f.store.get('match-override','obs'),null);assert.ok(await f.store.get('observation','obs'));await f.store.deleteSource('mail','mail');assert.equal((await f.store.get('bill','socket')).amountCents,null);
});
test('secondary Gmail rejects wrong identities and cannot resurrect a deleted budget',async t=>{
  const f=fixture(t);await f.store.initialize();const owner=await f.deps.hash(f.env.OWNER_EMAIL),record={owner,expected:'legacy@example.com',sessionId:'session',generation:(await f.store.get('settings','main')).generation};f.records.set('session:session',{kind:'google',expires:Date.now()+60000});
  await assert.rejects(completeBudgetMail(f.env,record,{},{email_verified:true,email:'someone@example.com'},f.deps),/older Gmail account/);
  const result={scope:'https://www.googleapis.com/auth/gmail.readonly',access_token:'test-access',refresh_token:'test-refresh',expires_in:3600};f.deps.provider=async()=>({emailAddress:record.expected});await f.store.remove('settings','main');await assert.rejects(completeBudgetMail(f.env,record,result,{email_verified:true,email:record.expected},f.deps),/deleted or recreated/);assert.equal((await f.store.list('mail-source')).length,0);
});
async function encryptedSession(env,token,value){const key=await crypto.subtle.importKey('raw',Buffer.from(env.TOKEN_ENCRYPTION_KEY,'base64'),{name:'AES-GCM'},false,['encrypt']),iv=crypto.getRandomValues(new Uint8Array(12)),cipher=await crypto.subtle.encrypt({name:'AES-GCM',iv},key,new TextEncoder().encode(JSON.stringify(value))),id=Buffer.from(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token))).toString('hex');await env.NEST_KV.put('session:'+id,JSON.stringify({iv:Buffer.from(iv).toString('base64'),data:Buffer.from(cipher).toString('base64')}));}
test('every financial operation rejects anonymous, foreign-origin, Nest-only and different-owner sessions',async t=>{
  const f=fixture(t);Object.assign(f.env,{TOKEN_ENCRYPTION_KEY:Buffer.alloc(32,7).toString('base64'),GOOGLE_CLIENT_ID:'test',GOOGLE_CLIENT_SECRET:'test'});const token='a'.repeat(64),paths=['snapshot','institutions','transactions','bill','settings','income','account','transaction','observation','match','mail/enable','mail/connect','mail/disconnect','link-token','exchange','balances','bank/disconnect','sync','sync/queue','csv/import','csv/undo','delete'];
  for(const path of paths){const response=await gateway.fetch(new Request('https://gateway.test/budget/'+path,{headers:{Origin:f.env.FRONTEND_ORIGIN}}),f.env);assert.equal(response.status,401,path);}
  for(const path of ['csv/import','csv/undo'])assert.equal((await gateway.fetch(new Request(post('/'+path,{}),{headers:{Origin:f.env.FRONTEND_ORIGIN,'Content-Type':'application/json'}}),f.env)).status,401,path);
  await encryptedSession(f.env,token,{kind:'google',ownerEmail:f.env.OWNER_EMAIL,expires:Date.now()+30*86400000});const good={Origin:f.env.FRONTEND_ORIGIN,Authorization:'Bearer '+token,'X-Budget-Mode':'on-demand-v1'};assert.equal((await gateway.fetch(new Request('https://gateway.test/budget/snapshot',{headers:{...good,Origin:'https://evil.test'}}),f.env)).status,403);const response=await gateway.fetch(new Request('https://gateway.test/budget/snapshot',{headers:good}),f.env);assert.equal(response.status,200);assert.match(response.headers.get('Cache-Control'),/no-store/);
  for(const path of ['csv/import','csv/undo'])assert.equal((await gateway.fetch(new Request('https://gateway.test/budget/'+path,{method:'POST',headers:{...good,Origin:'https://evil.test','Content-Type':'application/json'},body:'{}'}),f.env)).status,403,path);
  await encryptedSession(f.env,token,{kind:'nest',expires:Date.now()+30*86400000});assert.equal((await gateway.fetch(new Request('https://gateway.test/budget/snapshot',{headers:good}),f.env)).status,401);await encryptedSession(f.env,token,{kind:'google',ownerEmail:'other@example.com',expires:Date.now()+30*86400000});assert.equal((await gateway.fetch(new Request('https://gateway.test/budget/snapshot',{headers:good}),f.env)).status,403);
});
test('financial writes require confirmation, enforce sync throttling and preserve existing Google/Nest grants',async t=>{
  const f=fixture(t);await f.store.initialize();f.records.set('google:owner',{access:'keep'});f.records.set('owner',{access:'keep-nest'});await assert.rejects(handleBudget(post('/delete',{}),f.env,'owner','session',f.deps),/Type DELETE/);await handleBudget(post('/sync/queue',{}),f.env,'owner','session',f.deps);await assert.rejects(handleBudget(post('/sync/queue',{}),f.env,'owner','session',f.deps),/one minute/);await handleBudget(post('/delete',{confirmation:'DELETE MY BUDGET DATA'}),f.env,'owner','session',f.deps);assert.equal((await f.store.list('bill')).length,0);assert.equal(f.records.get('google:owner').access,'keep');assert.equal(f.records.get('owner').access,'keep-nest');
});
test('real gateway exchanges Link server-side and encrypts Plaid tokens without returning them',async t=>{
  const f=fixture(t);Object.assign(f.env,{TOKEN_ENCRYPTION_KEY:Buffer.alloc(32,9).toString('base64'),GOOGLE_CLIENT_ID:'test',GOOGLE_CLIENT_SECRET:'test',PLAID_ENV:'production'});const token='b'.repeat(64);await encryptedSession(f.env,token,{kind:'google',ownerEmail:f.env.OWNER_EMAIL,expires:Date.now()+30*86400000});
  const institution={institution_id:'central-personal',name:'Central Bank (MO) - Personal',url:'https://www.centralbank.net',products:['balance','transactions'],connection_availability:'SUPPORTED'},calls=[];
  t.mock.method(globalThis,'fetch',async(url,options)=>{const path=new URL(url).pathname,body=JSON.parse(options.body);assert.equal(new URL(url).origin,'https://production.plaid.com');assert.equal(body.secret,'test-secret');calls.push(path);return Response.json(path==='/institutions/search'?{institutions:[institution]}:path==='/link/token/create'?{link_token:'short-lived-link',expiration:new Date(Date.now()+60000).toISOString()}:path==='/item/public_token/exchange'?{access_token:'never-return-this-bank-token',item_id:'item'}:path==='/item/get'?{item:{institution_id:'central-personal'}}:path==='/institutions/get_by_id'?{institution}:path==='/accounts/get'?{accounts:[{account_id:'account',name:'Cash',type:'depository',balances:{current:100,available:null,iso_currency_code:'USD'}}]}:{});});
  const invoke=(path,body)=>gateway.fetch(new Request('https://gateway.test/budget'+path,{method:'POST',headers:{Origin:f.env.FRONTEND_ORIGIN,Authorization:'Bearer '+token,'X-Budget-Mode':'on-demand-v1','Content-Type':'application/json'},body:JSON.stringify(body)}),f.env);
  assert.equal((await invoke('/link-token',{})).status,200);const response=await invoke('/exchange',{publicToken:'public-link-token'});assert.equal(response.status,200);assert.doesNotMatch(await response.text(),/never-return|test-secret|access_token/);const owner=await f.deps.hash(f.env.OWNER_EMAIL),store=new BudgetStore(f.db,owner),item=await store.get('item','item');assert.ok(item.tokenKey);assert.doesNotMatch(f.records.get(item.tokenKey),/never-return-this-bank-token/);assert.doesNotMatch(JSON.stringify(await store.list('item')),/never-return/);assert.equal((await store.get('account','account')).availableCents,null);assert.ok(calls.includes('/institutions/get_by_id'));
});
test('webhooks and old cron deliveries cannot read, write, or sync the on-demand budget',async t=>{
  const f=fixture(t);t.mock.method(f.db,'prepare',()=>{throw Error('Unexpected background database access');});
  t.mock.method(globalThis,'fetch',()=>{throw Error('Unexpected background provider access');});
  const request=()=>new Request('https://gateway.test/budget/plaid/webhook',{method:'POST',body:JSON.stringify({item_id:'item',webhook_type:'TRANSACTIONS',webhook_code:'SYNC_UPDATES_AVAILABLE'})});
  for(let i=0;i<2;i++){const response=await plaidWebhook(request(),f.env,f.deps);assert.equal(response.status,202);assert.deepEqual(await response.json(),{accepted:true,mode:'on-demand',processed:false});}
  await scheduledBudget(f.env,f.deps);await gateway.scheduled({},f.env,{waitUntil(){throw Error('Unexpected background job');}});
});


test('CSV imports are atomic, exact, owner-scoped, idempotent and visible in historical summaries without fake balances',async t=>{
 const f=fixture(t),rows=mapCsvRows(parseCsv('Date,Description,Amount,Balance\n2000-01-05,Shop,-42.15,999999\n2000-01-05,Shop,-42.15,999999\n2000-01-05,ACH DEPOSIT PAYROLL,1000,999999'));
 const input={accountLabel:'Central Bank checking',confirmation:'IMPORT CSV',rows};
 const result=await (await handleBudget(post('/csv/import',input),f.env,'owner','session',f.deps)).json();assert.equal(result.added,3);
 assert.equal((await f.store.list('account')).length,0);assert.equal((await f.store.list('item')).length,0);
 const ids=(await f.store.list('transaction')).map(r=>r.id);await f.store.put('annotation',ids[0],{id:ids[0],category:'User corrected'});
 const again=await (await handleBudget(post('/csv/import',{...input,rows:[...rows].reverse()}),f.env,'owner','session',f.deps)).json();assert.equal(again.added,0);assert.equal(again.duplicates,3);assert.equal((await f.store.get('annotation',ids[0])).category,'User corrected');
 const snap=await snapshot(f.store,f.env,new URL('https://gateway.test/budget/snapshot?activityStart=2000-01-01&activityEnd=2000-01-07'));
 assert.equal(snap.activity.amountCents,8430);assert.equal(snap.activity.purchaseCount,2);assert.equal(snap.summary.cashAccountCount,0);assert.equal(snap.csvSources[0].rowCount,3);assert.equal(snap.csvImports.length,1);assert.ok(!('transactionIds' in snap.csvImports[0]));assert.equal(snap.csvPaused,false);
 assert.equal((await f.store.list('transaction')).some(r=>'balance' in r||'currentCents' in r),false);
 const other=new BudgetStore(f.db,'other-owner');await importCsv(other,input);assert.equal((await other.list('transaction')).length,3);
 await handleBudget(post('/csv/undo',{id:result.batchId,confirmation:'UNDO CSV'}),f.env,'owner','session',f.deps);assert.equal((await f.store.list('transaction')).length,0);assert.equal((await other.list('transaction')).length,3);assert.equal((await f.store.list('annotation')).length,0);
});
test('bad CSV rows, forged types and missing confirmation cannot partially import; D1 failure rolls back the batch',async t=>{
 const f=fixture(t),good={date:'2000-01-05',description:'Shop',signedCents:-100,classification:'purchase'},base={accountLabel:'Checking',confirmation:'IMPORT CSV',rows:[good]};
 for(const rows of [[good,{...good,date:null}],[{...good,date:'2000-02-30'}],[{...good,signedCents:1.1}],[{...good,classification:'fake'}],[{...good,description:''}],[{...good,date:'2999-01-01'}],Array(501).fill(good)]){
  await assert.rejects(handleBudget(post('/csv/import',{...base,rows}),f.env,'owner','session',f.deps));assert.equal((await f.store.list('transaction')).length,0);
 }
 await assert.rejects(handleBudget(post('/csv/import',{...base,confirmation:''}),f.env,'owner','session',f.deps),/confirm/);
 const real=f.store.putStatement.bind(f.store);t.mock.method(f.store,'putStatement',(kind,...args)=>kind==='csv-source'?f.store.statement('INSERT INTO nonexistent_csv_table VALUES(1)'):real(kind,...args));
 await assert.rejects(importCsv(f.store,base));assert.equal((await f.store.list('transaction')).length,0);
});
test('real Plaid history pauses CSV totals while sandbox history does not; undo affects only its own batch',async t=>{
 const f=fixture(t),base={accountLabel:'Checking',confirmation:'IMPORT CSV',rows:[{date:'2000-01-05',description:'CSV Shop',signedCents:-100,classification:'purchase'}]};
 const first=await (await handleBudget(post('/csv/import',base),f.env,'owner','session',f.deps)).json();
 const second=await (await handleBudget(post('/csv/import',{...base,rows:[...base.rows,{date:'2000-01-06',description:'Other Shop',signedCents:-200,classification:'purchase'}]}),f.env,'owner','session',f.deps)).json();assert.equal(second.added,1);
 const url=new URL('https://gateway.test/budget/snapshot?activityStart=2000-01-01&activityEnd=2000-01-07');
 await f.store.put('transaction','sandbox',{id:'sandbox',date:'2000-01-05',amountCents:100,currency:'USD',classification:'purchase',environment:'sandbox'});assert.equal((await snapshot(f.store,f.env,url)).activity.amountCents,300);
 await f.store.put('transaction','plaid',{id:'plaid',date:'2000-01-05',amountCents:100,currency:'USD',classification:'purchase',environment:'production'});
 const paused=await snapshot(f.store,f.env,url);assert.equal(paused.activity.amountCents,100);assert.equal(paused.csvPaused,true);assert.equal(paused.transactions.filter(r=>r.source==='csv'&&r.excludedFromTotals).length,2);
 await assert.rejects(handleBudget(post('/csv/undo',{id:first.batchId}),f.env,'owner','session',f.deps),/Confirm/);
 await handleBudget(post('/csv/undo',{id:second.batchId,confirmation:'UNDO CSV'}),f.env,'owner','session',f.deps);assert.equal((await f.store.list('transaction')).filter(r=>r.source==='csv').length,1);assert.ok(await f.store.get('transaction','plaid'));
});

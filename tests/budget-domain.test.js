import test from 'node:test';
import assert from 'node:assert/strict';
import {money,today,addDays,seedBills,merchantFor,occurrences,buildSummary,matchReceipts,normalizeTransaction,incomeOccurrences} from '../nest-service/budget/domain.mjs';
import {parseBudgetMessage} from '../nest-service/budget/mail.mjs';
import {institutionSupported,verifyWebhook} from '../nest-service/budget/plaid.mjs';
const now=new Date('2026-10-15T18:00:00Z');
const account={id:'cash',type:'depository',environment:'production',currency:'USD',balanceAt:now.toISOString(),currentCents:100000,availableCents:90000};
const transaction=(id,amountCents,extra={})=>({id,amountCents,date:'2026-10-14',accountId:'cash',merchantId:'socket',merchant:'Socket',category:'Internet',classification:'purchase',currency:'USD',environment:'production',pending:false,...extra});
const bill={id:'socket',name:'Socket',merchantId:'socket',category:'Internet',status:'active',frequency:'monthly',day:20,amountCents:10000};
const summary=input=>buildSummary({accounts:[account],bills:[bill],...input},now);
const receipt=(id,amountCents,extra={})=>({id,kind:'receipt',merchantId:'socket',amountCents,currency:'USD',date:'2026-10-14',...extra});

test('budget cents and Chicago bill dates are exact across DST and UTC midnight',()=>{
  assert.equal(money('123.47'),12347);assert.equal(money(0.29),29);assert.equal(money(null),null);assert.throws(()=>money('1.001'));assert.throws(()=>money(1.001));
  assert.equal(today(new Date('2026-11-01T04:30:00Z')),'2026-10-31');assert.equal(addDays('2026-10-31',2),'2026-11-02');
  const dates=occurrences({...bill,day:31},'2026-10-01','2026-12-31').map(e=>e.date);assert.deepEqual(dates,['2026-10-31','2026-11-30','2026-12-31']);
});
test('public defaults contain no personal financial amounts or assumed schedules',()=>{const bills=seedBills();assert.ok(bills.every(b=>b.amountCents===null&&b.frequency===null&&!b.day));assert.equal(buildSummary({bills},now).projection,null);});
test('memberships and purchases stay separate, including bank billing aliases',()=>{
  for(const [text,id] of [['WMTPLUS','walmart-plus'],['Walmart supercenter','walmart'],['AMZNPRIME','amazon-prime'],['AMZN Mktp','amazon'],['UBER *EATS','uber-eats'],['UBER *TRIP','uber']])assert.equal(merchantFor(text)?.id,id,text);
  assert.equal(normalizeTransaction({transaction_id:'a',account_id:'b',merchant_name:'Walmart',name:'WMTPLUS',amount:12.95,date:'2026-10-15'}).merchantId,'walmart-plus');
});
test('pending-to-posted replacement, refunds, transfers and PayPal uncertainty do not inflate spending',()=>{
  const s=summary({transactions:[transaction('pending',2000,{pending:true}),transaction('posted',2000,{pendingId:'pending'}),transaction('refund',-500),transaction('transfer',50000,{classification:'transfer'}),transaction('p2p',10000,{classification:'p2p'}),transaction('uncertain',1000,{classification:'review'})]});
  assert.equal(s.spending.amountCents,1500);assert.equal(s.spending.pendingCents,0);assert.equal(s.spending.refundsCents,500);assert.ok(s.review.some(r=>r.transactionId==='uncertain'));
  assert.equal(normalizeTransaction({transaction_id:'p',account_id:'b',merchant_name:'PayPal',amount:10,date:'2026-10-15'}).classification,'review');
});
test('duplicate emails for one order count as one receipt, and split shipment payments match once',()=>{
  const matched=matchReceipts([transaction('first',3000),transaction('second',2000)],[receipt('a',5000,{orderId:'ORDER-1'}),receipt('b',5000,{orderId:'ORDER-1'})]);
  assert.equal(matched.matches.length,1);assert.deepEqual(matched.matches[0].transactionIds,['first','second']);assert.equal(matched.matches[0].sourceIds.length,2);assert.equal(matched.review.length,0);
});
test('ambiguous and conflicting receipt matches remain in review, without creating spending',()=>{
  assert.equal(matchReceipts([transaction('a',1000),transaction('b',1000)],[receipt('r',1000)]).matches.length,0);
  const s=summary({transactions:[],observations:[receipt('r',99999)]});assert.equal(s.spending.amountCents,0);assert.ok(s.review.some(r=>r.observationId==='r'));
  const conflict=matchReceipts([transaction('a',1000)],[receipt('r1',1000,{orderId:'same'}),receipt('r2',2000,{orderId:'same'})]);assert.equal(conflict.matches.length,0);assert.match(conflict.review[0].reason,/Conflicting/);
});
test('available-balance projections do not subtract a matched pending bill again',()=>{
  const s=summary({transactions:[transaction('pending',10000,{pending:true,date:'2026-10-18'})]});assert.equal(s.projection.baseCents,90000);assert.equal(s.projection.billCents,0);assert.equal(s.projection.afterBillsCents,90000);
  const current=summary({accounts:[{...account,availableCents:null}],transactions:[transaction('pending',10000,{pending:true,date:'2026-10-18'})]});assert.equal(current.projection.baseKind,'current');assert.equal(current.projection.billCents,10000);
});
test('paid obligations and posted payments are never deducted again; missing balances remain unknown',()=>{
  assert.equal(summary({transactions:[transaction('paid',10000,{date:'2026-10-19'})]}).projection.billCents,0);
  assert.equal(summary({events:[{id:'socket:2026-10-20',billId:'socket',merchantId:'socket',date:'2026-10-20',amountCents:10000,paymentStatus:'paid'}]}).projection.billCents,0);
  const missing=summary({accounts:[{...account,availableCents:null,currentCents:null}]});assert.equal(missing.availableCents,null);assert.equal(missing.projection,null);
});
test('annual charges are actual yearly amounts, variable bills are not repeated as known future charges',()=>{
  const annual={...bill,id:'annual',frequency:'annual',day:null,nextDate:'2026-10-25',amountCents:12000};
  const variable={...bill,id:'utility',variable:true,amountCents:12345};
  const s=summary({bills:[annual,variable]});assert.equal(s.monthlyCommitments.amountCents,1000);assert.equal(s.next30.length,1);assert.equal(s.next30[0].amountCents,12000);assert.equal(s.projection.billCents,12000);
});
test('the user mortgage deadline survives a different statement due date',()=>{
  const mortgage={id:'mortgage',name:'Mortgage',merchantId:'mortgage',amountCents:100000,frequency:'monthly',day:15,status:'active'};const s=summary({bills:[mortgage],events:[{id:'invoice',billId:'mortgage',merchantId:'mortgage',date:'2026-10-01',amountCents:100000,paymentStatus:'unpaid',source:'email'}]});
  assert.equal(s.bills[0].date,'2026-10-15');assert.equal(s.bills[0].contractualDueDate,'2026-10-01');
});
test('sandbox bank data is excluded from real spending, cash and projections',()=>{
  const s=summary({accounts:[{...account,environment:'sandbox'}],transactions:[transaction('test',999999,{environment:'sandbox'})]});assert.equal(s.spending.amountCents,0);assert.equal(s.currentCents,null);assert.equal(s.projection,null);
});
test('paydays and cushion enter the estimate only when explicitly supplied',()=>{
  const plan={id:'pay',name:'Pay',amountCents:20000,nextDate:'2026-10-16',frequency:'biweekly'};
  assert.deepEqual(incomeOccurrences(plan,'2026-10-15','2026-11-14').map(i=>i.date),['2026-10-16','2026-10-30','2026-11-13']);
  const s=summary({incomes:[plan],settings:{cushionCents:10000}});assert.equal(s.projection.afterBillsCents,140000);assert.equal(s.projection.cushionCents,10000);assert.equal(summary({}).projection.cushionCents,null);
});
function message(text,subject='Socket bill'){return {id:'abcdef1234',internalDate:String(now.getTime()),payload:{mimeType:'text/plain',headers:[{name:'From',value:'billing@socket.net'},{name:'Subject',value:subject}],body:{data:Buffer.from(text).toString('base64url')}}};}
test('mail discovery extracts labeled evidence and does not invent missing totals or dates',()=>{
  const result=parseBudgetMessage(message('Amount due: $72.50. Due date: October 25, 2026. Billed monthly.'),'abdickers@gmail.com','source');assert.equal(result.amountCents,7250);assert.equal(result.dueDate,'2026-10-25');assert.equal(result.frequency,'monthly');assert.equal(result.paymentStatus,'unpaid');assert.match(result.sourceUrl,/authuser=abdickers%40gmail.com/);
  const unknown=parseBudgetMessage(message('Your bill is available. Due on October 25.'),'abdickers@gmail.com','source');assert.equal(unknown.amountCents,null);assert.equal(unknown.dueDate,null);
  const conflict=parseBudgetMessage(message('Total: $20.00. Amount due: $30.00.'),'abdickers@gmail.com','source');assert.equal(conflict.amountCents,null);assert.ok(conflict.conflicts.length);
});
test('cancellation and Google service names come from actual message wording',()=>{
  const cancelled=parseBudgetMessage(message('Your Hulu subscription is cancelled. It will not renew.','Hulu subscription update'),'sage4997@gmail.com','source');assert.equal(cancelled.kind,'cancellation');
  const google=parseBudgetMessage(message('Google Home Premium subscription. Total paid: $100.00. Billed annually.','Your Google Home Premium receipt'),'abdickers@gmail.com','source');assert.equal(google.serviceName,'Google Home Premium');assert.equal(google.frequency,'annual');assert.equal(google.amountCents,10000);
});
test('institution identity requires centralbank.net, both products, and a supported personal connection',()=>{
  const institution={name:'Central Bank (MO) - Personal',url:'https://www.centralbank.net',products:['balance','transactions'],connection_availability:'SUPPORTED'};
  assert.ok(institutionSupported(institution));for(const change of [{url:'https://centralbank.net.evil.test'},{name:'Central Bank (MO) - Business'},{products:['transactions']},{connection_availability:'UNSUPPORTED'}])assert.equal(institutionSupported({...institution,...change}),false);
});
test('Plaid webhook signatures reject tampering, stale JWTs, wrong algorithms and expired keys',async()=>{
  const keys=await crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify']),publicKey=await crypto.subtle.exportKey('jwk',keys.publicKey),raw=new TextEncoder().encode('{"item_id":"test"}'),hash=Buffer.from(await crypto.subtle.digest('SHA-256',raw)).toString('hex'),iat=Math.floor(Date.now()/1000),kid='test-key';
  const jwk={...publicKey,alg:'ES256',kid,created_at:iat-1000,expired_at:null};
  async function sign(claims,algorithm='ES256'){const first=Buffer.from(JSON.stringify({alg:algorithm,kid})).toString('base64url'),second=Buffer.from(JSON.stringify(claims)).toString('base64url'),input=first+'.'+second,signature=await crypto.subtle.sign({name:'ECDSA',hash:'SHA-256'},keys.privateKey,new TextEncoder().encode(input));return input+'.'+Buffer.from(signature).toString('base64url');}
  const token=await sign({iat,request_body_sha256:hash});assert.ok(await verifyWebhook(raw,token,async()=>jwk));assert.equal(await verifyWebhook(new TextEncoder().encode('{}'),token,async()=>jwk),false);assert.equal(await verifyWebhook(raw,await sign({iat:iat-301,request_body_sha256:hash}),async()=>jwk),false);assert.equal(await verifyWebhook(raw,token,async()=>({...jwk,expired_at:iat})),false);assert.equal(await verifyWebhook(raw,await sign({iat,request_body_sha256:hash},'HS256'),async()=>jwk),false);
});

test('stale and disconnected cash balances withhold projections without erasing saved totals',()=>{for(const extra of [{balanceAt:'2026-10-12T00:00:00Z'},{disconnected:true}]){const s=summary({accounts:[{...account,...extra}]});assert.equal(s.staleCash,true);assert.equal(s.projection,null);assert.equal(s.availableCents,90000);}});

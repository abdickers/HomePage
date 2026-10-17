import test from 'node:test';
import assert from 'node:assert/strict';
import {budgetPreset,budgetToday,validateBudgetRange} from '../js/budget-period.js';
import {treasurySummaryMarkup,periodIsReady} from '../js/treasury-presentation.js';
import {activityRange,periodActivity} from '../nest-service/budget/activity.mjs';

test('Treasury presets use Chicago dates and exactly seven or thirty calendar dates across DST',()=>{
 const now=new Date('2026-11-02T01:30:00Z');assert.equal(budgetToday(now),'2026-11-01');
 assert.deepEqual(budgetPreset('7',now),{preset:'7',start:'2026-10-26',end:'2026-11-01'});
 assert.deepEqual(budgetPreset('30',now),{preset:'30',start:'2026-10-03',end:'2026-11-01'});
 assert.deepEqual(budgetPreset('month',now),{preset:'month',start:'2026-11-01',end:'2026-11-01'});
 assert.deepEqual(budgetPreset('7',new Date('2026-03-09T12:00:00Z')),{preset:'7',start:'2026-03-03',end:'2026-03-09'});
});
test('custom activity ranges reject invalid, reversed, future, missing and duplicate dates',()=>{
 const now=new Date('2026-10-17T18:00:00Z');
 for(const [start,end] of [['2026-02-30','2026-03-01'],['2026-10-18','2026-10-17'],['2026-10-17','2026-10-18'],['','2026-10-17']]) {
  assert.throws(()=>validateBudgetRange(start,end,now));
  assert.throws(()=>activityRange(new URLSearchParams({activityStart:start,activityEnd:end}),now));
 }
 assert.equal(activityRange(new URLSearchParams(),now),null);
 assert.throws(()=>activityRange(new URLSearchParams('activityStart=2026-01-01&activityStart=2026-01-02&activityEnd=2026-10-17'),now));
 assert.deepEqual(activityRange(new URLSearchParams('activityStart=2024-02-29&activityEnd=2026-10-17'),now),{start:'2024-02-29',end:'2026-10-17'});
});
test('period totals use full history, exclude sandbox/transfers and replace pending entries before applying dates',()=>{
 const row=(id,extra={})=>({id,date:'2026-10-12',environment:'production',currency:'USD',classification:'purchase',amountCents:100,merchant:'Store',category:'Food',...extra});
 const rows=[...Array.from({length:80},(_,i)=>row(String(i))),row('refund',{amountCents:-300}),row('pending',{pending:true,amountCents:600}),row('posted',{pendingId:'pending',date:'2026-10-13',amountCents:600}),row('future',{pending:true,date:'2026-10-18'}),row('outside',{date:'2026-10-10'}),row('sandbox',{environment:'sandbox',amountCents:999999}),row('transfer',{classification:'transfer',amountCents:99999}),row('foreign',{currency:'EUR',amountCents:99999}),row('deleted',{removed:true}),row('waiting',{pending:true,amountCents:700})];
 const result=periodActivity(rows,{start:'2026-10-11',end:'2026-10-17'});
 assert.equal(result.summary.amountCents,8300);assert.equal(result.summary.refundsCents,300);assert.equal(result.summary.pendingCents,700);
 assert.equal(result.summary.purchaseCount,82);assert.equal(result.summary.complete,true);assert.equal(result.summary.recent.length,5);
 assert.ok(!result.entries.some(t=>['pending','future','outside','deleted'].includes(t.id)));
 assert.equal(result.summary.byCategory[0].amountCents,8300);
 assert.equal(periodActivity(rows,{start:'2026-10-11',end:'2026-10-17'},true).summary.complete,false);
});
function summaryData() {
 return {items:[{environment:'production',lastSync:'2026-10-17T12:00:00Z'}],reviewCount:8,
  summary:{availableCents:12345,cashAccountCount:1,balanceAsOf:'2026-10-17T12:00:00Z',next7:[{name:'Test bill',date:'2026-10-18',amountCents:500,paymentStatus:'unknown',status:'upcoming'}]},
  activity:{start:'2026-10-11',end:'2026-10-17',complete:true,amountCents:4500,recent:[{merchant:'<script>alert(1)</script>',date:'2026-10-16',amountCents:4500,currency:'USD',classification:'purchase'}]}};
}
test('the summary has no editing actions, is bounded, escapes evidence and keeps cash/future periods explicit',()=>{
 const data=summaryData(),range={start:'2026-10-11',end:'2026-10-17'},cash=n=>String(n),date=x=>x,stamp=x=>x;
 const html=treasurySummaryMarkup({data,range,cash,date,stamp});
 assert.doesNotMatch(html,/data-budget-action|<input|<script>/);assert.match(html,/data-treasury-detail="spending"/);
 assert.match(html,/&lt;script&gt;/);assert.match(html,/Current balance/);assert.match(html,/next 7 days/);assert.match(html,/monthly limits/);
 assert.match(html,/12345/);assert.match(html,/4500/);
 const masked=treasurySummaryMarkup({data,range,cash:()=> 'MASKED',date,stamp});assert.doesNotMatch(masked,/12345|4500/);
});
test('unavailable or incomplete period coverage never becomes an exact spending total',()=>{
 const data=summaryData(),range={start:'2026-10-01',end:'2026-10-17'},date=x=>x,stamp=x=>x,cash=n=>String(n);
 assert.equal(periodIsReady(data,range),false);
 const html=treasurySummaryMarkup({data,range,cash,date,stamp});assert.match(html,/Not available/);assert.doesNotMatch(html,/4500/);
 data.activity.start=range.start;data.activity.complete=false;
 const partial=treasurySummaryMarkup({data,range,cash,date,stamp});assert.match(partial,/totals are withheld/);assert.match(partial,/Not available/);
});

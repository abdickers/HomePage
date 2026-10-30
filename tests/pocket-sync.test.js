import {test} from 'node:test';
import assert from 'node:assert/strict';
import {snapshotCards} from '../js/pocket-sync.js';

function documentWith(values){return {querySelector:s=>values[s]===undefined?null:{textContent:values[s]},querySelectorAll:s=>(Array.isArray(values[s])?values[s]:[]).map(textContent=>({textContent}))};}
test('phone summaries never read banking, Warcraft, tokens, or unrelated sources',()=>{
 const consulted=[];const doc={querySelector:s=>{consulted.push(s);return {textContent:'Available'};},querySelectorAll:s=>{consulted.push(s);return [{textContent:'Available'}];}};
 for(const realm of ['personal','work']){const cards=snapshotCards(doc,realm);assert.ok(cards.length<=6);assert.ok(!cards.some(x=>/budget|treasury|warcraft/i.test(x.key)));}
 assert.ok(!consulted.some(x=>/budget|treasury|wow|token|session|password|input/i.test(x)));
});
test('snapshots stay bounded even when a page has huge lists',()=>{
 const doc=documentWith({'#weatherDesc':'x'.repeat(100000),'#eventList .event-row':Array(1000).fill('y'.repeat(10000))});
 const cards=snapshotCards(doc,'personal');assert.ok(cards.every(c=>c.body.length<=640));assert.ok(JSON.stringify(cards).length<4000);
});
test('uses visible real calendar and weather values; unknown realms export nothing',()=>{
 const doc=documentWith({'#weatherTemp':'71°F','#weatherHumidity':'58%','#weatherWind':'2 mph','#weatherUpdated':'12:30 PM','#eventList .event-row':['10 AM Planning','2 PM Call']});
 const cards=snapshotCards(doc,'personal');assert.match(cards.find(c=>c.key==='weather').body,/71°F/);assert.match(cards.find(c=>c.key==='calendar').body,/10 AM Planning/);assert.deepEqual(snapshotCards(doc,'attacker'),[]);
});

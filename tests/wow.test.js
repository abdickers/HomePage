import test from 'node:test';
import assert from 'node:assert/strict';
import {eventRows,safeWowURL} from '../js/wow-data.js';
const now=Date.parse('2026-10-15T21:00:00Z'),seconds=now/1000;
const snapshot=groups=>({updated:new Date(now).toISOString(),groups});
test('published repeating event moves between active and next window',()=>{
 const s=snapshot([{name:'Assault',timing:{anchor:seconds-60,intervalSecs:1800,durationSecs:900}}]);
 assert.equal(eventRows(s,'retail',now)[0].label,'Active now');
 const next=eventRows(s,'retail',now+1000000)[0];assert.equal(next.label,'Next up');assert.match(next.detail,/Starts in/);
 assert.deepEqual(eventRows(s,'retail',now+4*3600000),[]);
});
test('expired source windows disappear and exact future windows count down',()=>{
 const s=snapshot([{name:'World event',content:{lines:[{name:'Old',startingUt:seconds-500,endingUt:seconds-1},{name:'Next',startingUt:seconds+300,endingUt:seconds+600}]}}]);
 const rows=eventRows(s,'retail',now);assert.equal(rows.length,1);assert.equal(rows[0].label,'Upcoming');assert.equal(rows[0].detail,'Starts in 5m');
});
test('Forever stays separate and preserves date-only schedule uncertainty',()=>{
 const s={events:[{name:'Fishing',startDate:'2026-10-14',endDate:'2026-10-16'},{name:'Expired',startDate:'2026-10-10',endDate:'2026-10-12'}]};
 const rows=eventRows(s,'forever',now);assert.equal(rows.length,1);assert.equal(rows[0].label,'On the calendar');assert.match(rows[0].detail,/calendar dates/);
});
test('snapshot age is visible through last-known labels and external links are constrained',()=>{
 const s=snapshot([{name:'Weekly',content:{lines:[{name:'Bonus'}]}}]);
 assert.equal(eventRows(s,'retail',now+4*3600000)[0].label,'Last known');
 assert.equal(safeWowURL('javascript:alert(1)'),'https://www.wowhead.com/today-in-wow');
 assert.equal(safeWowURL('https://evil.test/'),'https://www.wowhead.com/today-in-wow');
 assert.equal(safeWowURL('/event=1'),'https://www.wowhead.com/event=1');
});

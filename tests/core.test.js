import test from 'node:test';
import assert from 'node:assert/strict';
import {safeUrl,escapeHtml,normalizeData,normalizeSettings,readData,DATA_KEY,mergeBackup,localDate,validDate,taskGroup,normalizeObservation,DEFAULT_LINKS} from '../js/core.js';

test('URLs reject executable schemes and credentials while keeping encoded query strings',()=>{
  for(const url of ['javascript:alert(1)','data:text/html,x','file:///C:/secret','https://user:pass@example.com','//example.com'])assert.equal(safeUrl(url),null);
  assert.equal(safeUrl('https://example.com/?q=hello%20world'),'https://example.com/?q=hello%20world');
  assert.equal(escapeHtml('<img src=x onerror="alert(1)">'), '&lt;img src=x onerror=&quot;alert(1)&quot;&gt;');
  assert.ok(DEFAULT_LINKS.every(l=>safeUrl(l.url)&&l.url!=='#'));
});
test('old saved tasks and notes migrate without seeding fake tasks',()=>{
  const values={'sage_tasks_v2':JSON.stringify([{text:'Existing quest',done:true}]),'sage_notes_v2':JSON.stringify([['Idea','Keep this note']])};
  const saved=readData({getItem:k=>values[k]??null});
  assert.equal(saved.tasks[0].text,'Existing quest');assert.equal(saved.tasks[0].done,true);assert.equal(saved.notes[0].text,'Keep this note');
  assert.equal(readData({getItem:()=>null}).tasks.length,0);
});
test('new state takes precedence and empty lists stay empty',()=>{
  const values={[DATA_KEY]:JSON.stringify({tasks:[],notes:[],links:[]}),'sage_tasks_v2':'[{"text":"Old quest"}]'};
  const saved=readData({getItem:k=>values[k]??null});assert.deepEqual(saved.tasks,[]);assert.deepEqual(saved.links,[]);
});
test('corrupt storage and malformed data do not stop initialization',()=>{
  assert.doesNotThrow(()=>readData({getItem:()=>'{bad json'}));
  assert.doesNotThrow(()=>readData({getItem:()=>{throw Error('Blocked');}}));
  assert.doesNotThrow(()=>normalizeData({tasks:[null,{},'no'],notes:[null],links:[null,{}]}));
  assert.equal(normalizeData({tasks:[{id:'a',text:'one'},{id:'a',text:'new'}]}).tasks.length,1);
  assert.equal(normalizeSettings({location:{name:'Bad',lat:200,lon:10}}).location.name,'Columbia, MO');
});
test('backup merges by ID without dropping existing tasks and rejects unrelated JSON',()=>{
  const current=normalizeData({tasks:[{id:'a',text:'keep'},{id:'b',text:'old'}]});
  const backup=normalizeData({tasks:[{id:'b',text:'new'},{id:'c',text:'import'}]});
  const merged=mergeBackup(current,backup);assert.deepEqual(merged.tasks.map(t=>t.text),['keep','new','import']);
  assert.throws(()=>mergeBackup(current,{hello:'world'}));assert.throws(()=>mergeBackup(current,null));
});
test('tasks use local calendar dates and future tasks appear in Upcoming',()=>{
  assert.equal(localDate(new Date(2026,9,14,23,59)),'2026-10-14');
  assert.equal(taskGroup({due:'2026-10-15'},'2026-10-14'),'upcoming');
  assert.equal(taskGroup({due:'2026-10-13'},'2026-10-14'),'today');
  assert.equal(taskGroup({due:''},'2026-10-14'),'today');
  assert.ok(validDate('2028-02-29'));assert.equal(validDate('2026-02-29'),false);assert.equal(validDate('2026-99-01'),false);
});
test('NWS wind units are converted from km/h, m/s, knots or mph',()=>{
  const obs={temperature:{value:20,unitCode:'wmoUnit:degC'},windSpeed:{value:36,unitCode:'wmoUnit:km_h-1'},relativeHumidity:{value:55},precipitationLastHour:{value:25.4,unitCode:'wmoUnit:mm'}};
  const imperial=normalizeObservation(obs,'fahrenheit');assert.equal(imperial.temp,68);assert.ok(Math.abs(imperial.wind-22.36936)<.001);assert.equal(imperial.rain,1);
  const metric=normalizeObservation(obs,'celsius');assert.equal(metric.wind,36);assert.equal(metric.rain,25.4);
  assert.ok(Math.abs(normalizeObservation({...obs,windSpeed:{value:10,unitCode:'wmoUnit:m_s-1'}},'fahrenheit').wind-22.36936)<.001);
  assert.equal(normalizeObservation({...obs,windSpeed:{value:5,unitCode:'unknown'}},'fahrenheit').wind,null);
});
test('missing weather measurements stay missing, never zero',()=>{
  const w=normalizeObservation({temperature:{value:null},windSpeed:{value:null},precipitationLastHour:{value:null}},'fahrenheit');
  assert.equal(w.temp,null);assert.equal(w.wind,null);assert.equal(w.rain,null);assert.equal(w.humidity,null);
});

test('the Pages entry point is HTML and its local resources exist',async()=>{
  const {readFile,access}=await import('node:fs/promises');
  const root=new URL('../',import.meta.url),html=await readFile(new URL('index.html',root),'utf8');
  assert.match(html,/^<!doctype html>/i);assert.match(html,/<script type="module" src="js\/app.js"><\/script>/);
  const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);assert.equal(ids.length,new Set(ids).size);
  const paths=[...html.matchAll(/\b(?:src|href)="([^"]+)"/g)].map(m=>m[1]).filter(p=>!p.startsWith('#')&&!/^[a-z]+:/i.test(p));
  for(const p of paths)await access(new URL(p,root));
  const css=await readFile(new URL('css/styles.css',root),'utf8');
  for(const match of css.matchAll(/url\("([^"]+)"\)/g))await access(new URL(match[1],new URL('css/',root)));
});

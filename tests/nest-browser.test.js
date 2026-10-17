import test from 'node:test';
import assert from 'node:assert/strict';
import {initNest} from '../js/nest.js';
import {rememberSession,readSession} from '../js/remembered-session.js';
const origin='https://nest.test',credential='c'.repeat(64),tick=()=>new Promise(setImmediate);
function fixture(t){
 const data=new Map(),elements=new Map(),calls=[];
 const storage={getItem:key=>data.get(key)||null,setItem:(key,value)=>data.set(key,value),removeItem:key=>data.delete(key)};
 const element=id=>{if(!elements.has(id))elements.set(id,{textContent:'',value:'',hidden:false,disabled:false,listeners:{},addEventListener(name,fn){this.listeners[name]=fn;},replaceChildren(){},pause(){}});return elements.get(id);};
 global.document={getElementById:element,addEventListener(){},hidden:false};global.window={localStorage:storage,addEventListener(){},open(){throw Error('Remembered Nest must not open sign-in.');}};global.location={hash:'',pathname:'/HomePage/',search:''};global.history={replaceState(){}};
 t.mock.method(globalThis,'setInterval',()=>0);
 t.mock.method(globalThis,'fetch',async(url,options)=>{calls.push({url,options});return Response.json(url.endsWith('/health')?{configured:true}:url.endsWith('/devices')?{devices:[],updatedAt:new Date().toISOString(),sessionExpiresAt:Date.now()+30*86400000}:{});});
 return {storage,element,calls};
}
test('Nest restores its remembered credential on page startup and signing out removes it',async t=>{
 const f=fixture(t);rememberSession(f.storage,'nest',origin,credential,Date.now()+10000);initNest(origin);await tick();await tick();
 const read=f.calls.find(call=>call.url.endsWith('/devices'));assert.equal(read.options.headers.Authorization,'Bearer '+credential);assert.match(f.element('nestStatus').textContent,/sign-in remembered/);
 assert.ok(readSession(f.storage,'nest',origin).expiresAt>Date.now()+29*86400000);
 await f.element('nestDisconnect').listeners.click();assert.equal(readSession(f.storage,'nest',origin),null);assert.equal(f.element('nestDisconnect').hidden,true);assert.ok(f.calls.some(call=>call.url.endsWith('/disconnect')));
});
test('expired Nest browser credentials are removed instead of being silently reused',async t=>{
 const f=fixture(t);rememberSession(f.storage,'nest',origin,credential,1000,0);initNest(origin);await tick();await tick();
 assert.equal(f.calls.filter(call=>call.url.endsWith('/devices')).length,0);assert.equal(readSession(f.storage,'nest',origin),null);assert.equal(f.element('nestConnect').disabled,false);
});

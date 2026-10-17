import test from 'node:test';
import assert from 'node:assert/strict';
import {readSession,rememberSession,forgetSession,sessionKey} from '../js/remembered-session.js';
import {createGoogleConnection} from '../js/google-connection.js';
const origin='https://nest.test',credential='a'.repeat(64);
const storage=()=>{const data=new Map();return {getItem:key=>data.get(key)||null,setItem:(key,value)=>data.set(key,value),removeItem:key=>data.delete(key)};};
function browser(){const listeners={};return {localStorage:storage(),location:{hash:'',pathname:'/HomePage/',search:''},history:{replaceState(){}},addEventListener:(name,fn)=>{listeners[name]=fn;},open(){throw Error('Restoring a connection must not open OAuth.');},listeners};}

test('remembered app sessions survive reload, stay bound to a gateway, and can be forgotten',()=>{
 const store=storage();assert.equal(rememberSession(store,'nest',origin,credential,2000,1000),true);
 assert.deepEqual(readSession(store,'nest',origin,1000),{session:credential,expiresAt:2000});
 assert.equal(readSession(store,'google',origin,1000),null);
 assert.equal(readSession(store,'nest','https://another.test',1000),null);
 assert.equal(store.getItem(sessionKey('nest')),null);
 rememberSession(store,'nest',origin,credential,2000,1000);forgetSession(store,'nest');assert.equal(readSession(store,'nest',origin,1000),null);
});
test('expired, corrupt, and blocked session storage fail closed without breaking the page',()=>{
 const store=storage();rememberSession(store,'nest',origin,credential,2000,1000);assert.equal(readSession(store,'nest',origin,2000),null);
 store.setItem(sessionKey('nest'),'{bad');assert.equal(readSession(store,'nest',origin),null);
 const blocked={getItem(){throw Error('Blocked');},setItem(){throw Error('Blocked');},removeItem(){throw Error('Blocked');}};
 assert.equal(readSession(blocked,'google',origin),null);assert.equal(rememberSession(blocked,'google',origin,credential,Date.now()+10000),false);
});
test('Google restores an existing browser session without OAuth and reads only through the private gateway',async()=>{
 const win=browser(),calls=[],expires=Date.now()+30*86400000;
 rememberSession(win.localStorage,'google',origin,credential,expires);
 const connection=createGoogleConnection(origin,{window:win,fetch:async(url,options)=>{calls.push({url,options});return Response.json(url.endsWith('/google/session')?{email:'abdickers@gmail.com',expiresAt:expires}:{items:[]});}});
 await connection.ready();assert.equal(connection.connected(),true);
 await connection.connect();await connection.read('https://www.googleapis.com/calendar/v3/calendars/primary/events');
 assert.ok(calls.every(call=>call.url.startsWith(origin+'/google/')));assert.ok(calls.every(call=>call.options.headers.Authorization==='Bearer '+credential));
 assert.equal(calls.length,2);connection.disconnect();assert.equal(connection.connected(),false);assert.equal(readSession(win.localStorage,'google',origin),null);
 assert.ok(calls.every(call=>call.options.credentials==='same-origin'));
 assert.equal(calls.at(-1).url,origin+'/google/disconnect');
});
test('revoked Google sessions are forgotten, while temporary gateway errors preserve them for retry',async()=>{
 for(const status of [401,503]){
  const win=browser();rememberSession(win.localStorage,'google',origin,credential,Date.now()+10000);
  const connection=createGoogleConnection(origin,{window:win,fetch:async()=>Response.json({error:'Connection unavailable'},{status})});
  await connection.ready();assert.equal(connection.connected(),false);
  assert.equal(Boolean(readSession(win.localStorage,'google',origin)),status===503);
 }
});
test('Google popup messages require the gateway and the exact popup before a session is saved',async()=>{
 const win=browser(),popup={closed:false,close(){}},calls=[];win.open=()=>popup;
 const connection=createGoogleConnection(origin,{window:win,fetch:async url=>{calls.push(url);return Response.json({email:'abdickers@gmail.com',expiresAt:Date.now()+100000});}});
 await connection.ready();const grant=connection.connect();
 win.listeners.message({origin:'https://untrusted.test',source:popup,data:{type:'sage-google-connected',session:credential}});
 assert.equal(calls.length,0);assert.equal(readSession(win.localStorage,'google',origin),null);
 win.listeners.message({origin,source:popup,data:{type:'sage-google-connected',session:credential}});
 await grant;assert.equal(connection.connected(),true);assert.ok(readSession(win.localStorage,'google',origin));
 connection.disconnect();
});

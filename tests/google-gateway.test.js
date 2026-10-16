import test from 'node:test';
import assert from 'node:assert/strict';
import worker,{SESSION_SECONDS} from '../nest-service/worker.mjs';
import {googleReadTarget,GOOGLE_SCOPES} from '../nest-service/google-read.mjs';
const base='https://gateway.test',origin='https://abdickers.github.io';
function fixture(){const records=new Map(),writes=[];return {records,writes,env:{FRONTEND_ORIGIN:origin,OWNER_EMAIL:'abdickers@gmail.com',NEST_PROJECT_ID:'nest-project',GOOGLE_CLIENT_ID:'client',GOOGLE_CLIENT_SECRET:'test-only',TOKEN_ENCRYPTION_KEY:btoa('b'.repeat(32)),NEST_KV:{get:async key=>records.get(key)||null,put:async(key,value,options)=>{records.set(key,value);writes.push({key,value,options});},delete:async key=>records.delete(key)}}};}
async function connect(t,f,{kind='google',email='abdickers@gmail.com',scope=GOOGLE_SCOPES}={}){
 const calls=[];t.mock.method(globalThis,'fetch',async(url,options)=>{
  calls.push({url:String(url),options});
  return Response.json(String(url).includes('/token')?{access_token:'private-google-token',refresh_token:'private-refresh-token',expires_in:3600,scope}:String(url).includes('userinfo')?{email,email_verified:true}:String(url).endsWith('/profile')?{emailAddress:email}:{devices:[],items:[]});
 });
 const start=await worker.fetch(new Request(base+'/auth/start?service='+kind),f.env),location=new URL(start.headers.get('Location')),state=location.searchParams.get('state');
 const response=await worker.fetch(new Request(base+'/auth/callback?code=fixture&state='+state,{headers:{Cookie:'__Host-nest-state='+state}}),f.env);
 const html=await response.text(),session=html.match(/#(?:google|nest)-session=([a-f0-9]{64})/)?.[1];
 return {response,html,session,location,calls};
}
function authenticated(session,path,options={}){return new Request(base+path,{...options,headers:{Origin:origin,Authorization:'Bearer '+session,...options.headers}});}

test('Google read allowlist rejects other hosts, mailbox users, writes, attachments, and ambiguous parameters',()=>{
 for(const target of ['https://untrusted.test/gmail/v1/users/me/profile','https://gmail.googleapis.com/gmail/v1/users/other/profile','https://gmail.googleapis.com/gmail/v1/users/me/messages/send','https://gmail.googleapis.com/gmail/v1/users/me/messages/abc/attachments/def','https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=500','https://gmail.googleapis.com/gmail/v1/users/me/messages?q=a&q=b','https://www.googleapis.com/calendar/v3/calendars/primary/events?access_token=bad'])assert.equal(googleReadTarget(target),null,target);
 for(const target of ['https://openidconnect.googleapis.com/v1/userinfo','https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=20&q=in%3Ainbox','https://gmail.googleapis.com/gmail/v1/users/me/messages/abc?format=metadata&metadataHeaders=From&metadataHeaders=Subject','https://www.googleapis.com/calendar/v3/calendars/primary/events?maxResults=50&singleEvents=true'])assert.ok(googleReadTarget(target));
});
test('Google consent grants only the read scopes, stores encrypted credentials separately, and issues a remembered session',async t=>{
 const f=fixture(),result=await connect(t,f);
 assert.equal(result.response.status,200);assert.equal(result.location.hostname,'accounts.google.com');assert.equal(result.location.searchParams.get('scope'),GOOGLE_SCOPES);assert.equal(result.location.searchParams.has('login_hint'),false);
 assert.ok(f.records.has('google:owner'));assert.equal(f.records.has('owner'),false);assert.doesNotMatch(f.records.get('google:owner'),/private-google-token|private-refresh-token/);
 assert.equal(f.writes.find(write=>write.key.startsWith('session:')).options.expirationTtl,SESSION_SECONDS);assert.ok(result.html.includes(origin+'/HomePage/#google-session='));
 const session=await worker.fetch(authenticated(result.session,'/google/session'),f.env),body=await session.json();assert.equal(body.email,'abdickers@gmail.com');assert.ok(body.expiresAt>Date.now()+29*86400000);assert.doesNotMatch(JSON.stringify(body),/private-/);
});
test('wrong Google accounts and missing read scopes cannot store a persistent owner connection',async t=>{
 const f=fixture(),result=await connect(t,f,{email:'other@example.com'});assert.equal(result.response.status,403);assert.equal(f.records.has('google:owner'),false);assert.equal(result.calls.length,2);
});
test('partial Google consent is rejected before reading the mailbox',async t=>{
 const f=fixture(),result=await connect(t,f,{scope:'openid email https://www.googleapis.com/auth/gmail.readonly'});assert.equal(result.response.status,403);assert.equal(f.records.has('google:owner'),false);assert.equal(result.calls.length,2);
});
test('remembered Google sessions refresh expired Google tokens without a new OAuth flow and sign-out revokes them',async t=>{
 const f=fixture(),result=await connect(t,f),now=Date.now();t.mock.method(Date,'now',()=>now+2*3600000);
 const before=result.calls.filter(call=>call.url.includes('/token')).length;
 const read=await worker.fetch(authenticated(result.session,'/google/read?'+new URLSearchParams({url:'https://gmail.googleapis.com/gmail/v1/users/me/profile'})),f.env);
 assert.equal(read.status,200);assert.equal((await read.json()).emailAddress,'abdickers@gmail.com');assert.equal(result.calls.filter(call=>call.url.includes('/token')).length,before+1);
 const signout=await worker.fetch(authenticated(result.session,'/google/disconnect',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'}),f.env);assert.equal(signout.status,200);
 assert.equal((await worker.fetch(authenticated(result.session,'/google/session'),f.env)).status,401);
});
test('Google and Nest sessions cannot be used for each other and foreign origins cannot read either',async t=>{
 const f=fixture(),result=await connect(t,f),nest=await connect(t,f,{kind:'nest'}),before=nest.calls.length;
 assert.equal((await worker.fetch(authenticated(nest.session,'/google/session'),f.env)).status,401);
 assert.equal((await worker.fetch(authenticated(result.session,'/devices'),f.env)).status,401);
 assert.equal((await worker.fetch(authenticated(result.session,'/google/session',{headers:{Origin:'https://untrusted.test'}}),f.env)).status,403);
 assert.equal((await worker.fetch(authenticated(result.session,'/google/read?'+new URLSearchParams({url:'https://untrusted.test/'})),f.env)).status,400);
 assert.equal((await worker.fetch(authenticated(result.session,'/google/read',{method:'POST'}),f.env)).status,405);assert.equal(nest.calls.length,before);
});
test('a rejected Google refresh revokes the app session instead of leaving a reusable browser credential',async t=>{
 const f=fixture(),result=await connect(t,f),now=Date.now();t.mock.method(Date,'now',()=>now+2*3600000);
 t.mock.method(globalThis,'fetch',async()=>Response.json({error:'invalid_grant'},{status:400}));
 assert.equal((await worker.fetch(authenticated(result.session,'/google/session'),f.env)).status,401);
 assert.equal([...f.records.keys()].some(key=>key.startsWith('session:')),false);
});
test('active remembered sessions renew their inactivity window and expired sessions cannot renew',async t=>{
 const f=fixture(),result=await connect(t,f),now=Date.now();t.mock.method(Date,'now',()=>now+8*86400000);
 const renewed=await worker.fetch(authenticated(result.session,'/google/session'),f.env);assert.equal(renewed.status,200);assert.ok((await renewed.json()).expiresAt>Date.now()+29*86400000);
 t.mock.method(Date,'now',()=>now+39*86400000);assert.equal((await worker.fetch(authenticated(result.session,'/google/session'),f.env)).status,401);
});

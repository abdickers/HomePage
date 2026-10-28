import test from 'node:test';
import assert from 'node:assert/strict';
import {playOverview,metricWindow,latestMetric,PLAY_SCOPE} from '../nest-service/play-reporting.mjs';
import worker,{boundedJson} from '../nest-service/worker.mjs';
import {createGoogleConnection} from '../js/google-connection.js';
import {rememberSession} from '../js/remembered-session.js';
import {rateText} from '../js/play-apps.js';
const app={name:'apps/com.example.test',displayName:'Test app',packageName:'com.example.test'};
test('listing apps does not fan out into metrics and catalogue pagination is bounded',async()=>{
 const calls=[];const result=await playOverview(new URL('https://gateway.test/play/overview'),'test',{boundedJson,fetcher:async url=>{calls.push(url);return Response.json({apps:[app],nextPageToken:'next'});}});
 assert.equal(calls.length,2);assert.ok(calls.every(url=>url.includes('apps:search?')));assert.equal(result.apps.length,1);assert.equal(result.more,true);assert.equal(result.report,null);
});
test('vitals use a seven-day window, only the selected app, and latest weighted percentages',async()=>{
 const calls=[];const result=await playOverview(new URL('https://gateway.test/play/overview?app=apps/com.example.test'),'test',{boundedJson,fetcher:async(url,options)=>{
  calls.push({url,options});if(url.includes('apps:search'))return Response.json({apps:[app]});
  if(!url.endsWith(':query'))return Response.json({freshnessInfo:{freshnesses:[{aggregationPeriod:'DAILY',latestEndTime:{year:2026,month:10,day:28}}]}});
  const input=JSON.parse(options.body);assert.equal(input.timelineSpec.startTime.day,21);assert.equal(input.timelineSpec.endTime.day,28);assert.equal(input.timelineSpec.startTime.timeZone.id,'America/Los_Angeles');assert.equal(input.userCohort,'APP_TESTERS');assert.equal(input.pageSize,7);assert.equal(Object.hasOwn(input.timelineSpec.startTime,'hours'),false);
  return Response.json({rows:[{startTime:{year:2026,month:10,day:27},metrics:[{metric:input.metrics[0],decimalValue:{value:'1.25'}}]}]});
 }});
 assert.equal(calls.length,5);assert.equal(result.report.crash.value,1.25);assert.equal(rateText(result.report.anr.value),'1.25%');assert.ok(calls.every(c=>c.url.startsWith('https://playdeveloperreporting.googleapis.com/v1beta1/')));
});
test('missing vitals remain unavailable, never a fabricated zero or healthy status',async()=>{
 const result=await playOverview(new URL('https://gateway.test/play/overview?app=apps/com.example.test'),'test',{boundedJson,fetcher:async url=>Response.json(url.includes('apps:search')?{apps:[app]}:{})});
 assert.equal(result.report.crash,null);assert.equal(result.report.anr,null);assert.equal(rateText(null),'Not available yet');assert.equal(rateText(0),'0%');assert.equal(metricWindow({year:2026,month:2,day:30}),null);assert.equal(latestMetric([], 'rate').value,null);
});
test('reporting rejects unrecognized parameters and credentials never follow a redirect',async()=>{
 let calls=0;for(const query of ['app=https://evil.test','cohort=ALL','app=apps/x&app=apps/y','url=https://evil.test'])await assert.rejects(()=>playOverview(new URL('https://gateway.test/play/overview?'+query),'test',{boundedJson,fetcher:async()=>{calls++;}}),{status:400});assert.equal(calls,0);
 await assert.rejects(()=>playOverview(new URL('https://gateway.test/play/overview'),'test',{boundedJson,fetcher:async(url,opts)=>{assert.equal(opts.redirect,'manual');return new Response(null,{status:302,headers:{Location:'https://evil.test'}});}}),{status:502});
});
test('Play connection is lazy and isolates its session and read API from Gmail',async()=>{
 const calls=[],records=new Map(),storage={getItem:k=>records.get(k),setItem:(k,v)=>records.set(k,v),removeItem:k=>records.delete(k)};
 rememberSession(storage,'play','https://gateway.test','a'.repeat(64),Date.now()+86400000);
 const win={location:{hash:'',pathname:'/',search:''},history:{replaceState(){}},addEventListener(){}};
 const connection=createGoogleConnection('https://gateway.test',{kind:'play',lazy:true,storage,window:win,fetch:async url=>{calls.push(url);return Response.json({email:'abdickers@gmail.com',expiresAt:Date.now()+86400000});}});
 assert.equal(calls.length,0);await connection.ready();assert.deepEqual(calls,['https://gateway.test/play/session']);await assert.rejects(()=>connection.read('https://gmail.googleapis.com/gmail/v1/users/me/profile'));assert.equal(calls.length,1);
});
test('Play OAuth encrypts a separate grant and never accesses budget D1',async t=>{
 const records=new Map();const env={FRONTEND_ORIGIN:'https://gateway.test',OWNER_EMAIL:'abdickers@gmail.com',GOOGLE_CLIENT_ID:'client',GOOGLE_CLIENT_SECRET:'test',TOKEN_ENCRYPTION_KEY:btoa('b'.repeat(32)),NEST_KV:{get:async k=>records.get(k),put:async(k,v)=>records.set(k,v),delete:async k=>records.delete(k)},BUDGET_DB:new Proxy({},{get(){throw Error('Play must not use D1');}})};
 const calls=[];t.mock.method(globalThis,'fetch',async url=>{calls.push(String(url));return Response.json(String(url).includes('/token')?{access_token:'private-token',refresh_token:'private-refresh',expires_in:3600,scope:PLAY_SCOPE}:{email:'abdickers@gmail.com',email_verified:true});});
 const start=await worker.fetch(new Request('https://gateway.test/auth/start?service=play'),env),location=new URL(start.headers.get('Location'));assert.equal(location.hostname,'accounts.google.com');assert.equal(location.searchParams.get('scope'),'openid email '+PLAY_SCOPE);
 const state=location.searchParams.get('state'),callback=await worker.fetch(new Request('https://gateway.test/auth/callback?code=test&state='+state,{headers:{Cookie:'__Host-nest-state='+state}}),env),html=await callback.text(),session=html.match(/#play-session=([a-f0-9]{64})/)[1];
 assert.equal(callback.status,200);assert.ok(records.has('play:owner'));assert.equal(records.has('google:owner'),false);assert.doesNotMatch(records.get('play:owner'),/private-token|private-refresh/);assert.equal(calls.length,2);
 const headers={Origin:env.FRONTEND_ORIGIN,Authorization:'Bearer '+session};assert.equal((await worker.fetch(new Request('https://gateway.test/google/session',{headers}),env)).status,401);
 assert.equal((await worker.fetch(new Request('https://gateway.test/play/session',{headers}),env)).status,200);assert.equal(calls.length,2);
});

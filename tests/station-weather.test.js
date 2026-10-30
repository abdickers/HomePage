import test from 'node:test';
import assert from 'node:assert/strict';
import {stationCurrent,stationObservation,STATION_FRESH_MS} from '../nest-service/station-weather.mjs';
import {stationWeather} from '../js/station-weather.js';
import {boundedJson} from '../nest-service/worker.mjs';
import {createPrivateWorker} from '../nest-service/private-worker.mjs';
import {AccessDenied} from '../nest-service/access-guard.mjs';
import {normalizeSettings} from '../js/core.js';
const origin='https://gateway.test',stationId='KTEST123',now=Date.UTC(2026,9,28,23,10),secret='test-key-not-real-1234567890';
const env={FRONTEND_ORIGIN:origin,WU_STATION_ID:stationId,WU_API_KEY:secret};
const request=(path='/weather/current',options)=>new Request(origin+path,options);
const payload=(extra={})=>({observations:[{stationID:stationId,epoch:now/1000-60,humidity:58,imperial:{temp:71,windSpeed:2,precipTotal:0},...extra}]});
test('station observation uses actual timestamps, preserves zero rain, and converts units once',()=>{
 const result=stationObservation(payload(),stationId,'Test cabin',now),f=stationWeather(result,'fahrenheit',now),c=stationWeather(result,'celsius',now);
 assert.equal(f.temp,71);assert.equal(f.rain,0);assert.equal(f.rainLabel,'Rain today');assert.equal(f.locationName,'Test cabin');assert.ok(Math.abs(c.temp-21.666666)<.0001);assert.equal(c.wind,3.218688);assert.equal(c.rain,0);assert.equal(c.description,'Live station readings');
 const missing=stationObservation(payload({imperial:{temp:0}}),stationId,'Test',now);assert.equal(missing.observation.tempF,0);assert.equal(missing.observation.rainTodayIn,null);assert.equal(stationWeather(missing,'fahrenheit',now).wind,null);
});
test('stale, future, mismatched and malformed observations cannot be presented as live',()=>{
 for(const body of [payload({epoch:(now-STATION_FRESH_MS-1)/1000}),payload({epoch:now/1000+121}),payload({stationID:'KOTHER1'}),payload({imperial:{temp:null}}),{observations:{}},{}])assert.equal(stationObservation(body,stationId,'Test',now).available,false);
 const result=stationObservation(payload(),stationId,'Test',now);assert.equal(stationWeather(result,'fahrenheit',now+STATION_FRESH_MS),null);
 assert.equal(stationWeather({available:false},'fahrenheit',now),null);
});
test('current endpoint uses a fixed provider and caches sanitized readings without credentials',async()=>{
 const stored=new Map(),calls=[];const cache={match:async key=>stored.get(key.url)?.clone(),put:async(key,res)=>stored.set(key.url,res.clone())};
 const fetcher=async(url,options)=>{calls.push({url,options});return Response.json(payload());};
 const options={boundedJson,cache,fetcher,now};
 const first=await stationCurrent(request(),env,options),second=await stationCurrent(request(),env,options);assert.equal((await first.json()).available,true);assert.equal((await second.json()).available,true);assert.equal(calls.length,1);
 const endpoint=new URL(calls[0].url);assert.equal(endpoint.origin,'https://api.weather.com');assert.equal(endpoint.pathname,'/v2/pws/observations/current');assert.equal(endpoint.searchParams.get('units'),'e');assert.equal(endpoint.searchParams.get('apiKey'),secret);assert.equal(calls[0].options.redirect,'manual');
 for(const [key,response]of stored){assert.ok(!key.includes(secret));assert.ok(!(await response.clone().text()).includes(secret));}
 const stale=await stationCurrent(request(),env,{...options,now:now+STATION_FRESH_MS});assert.equal((await stale.json()).reason,'STALE');assert.equal(calls.length,1);
});
test('missing credentials and arbitrary query input cause no provider reads; provider errors reveal no key',async()=>{
 let calls=0;const fetcher=async()=>{calls++;return new Response(secret,{status:403});};
 assert.equal((await(await stationCurrent(request(),{}, {fetcher})).json()).configured,false);assert.equal(calls,0);
 assert.equal((await stationCurrent(request('/weather/current?url=https://evil.test'),env,{fetcher})).status,400);assert.equal(calls,0);
 assert.equal((await stationCurrent(request('/weather/current',{method:'POST'}),env,{fetcher})).status,405);assert.equal(calls,0);
 const failed=await stationCurrent(request(),env,{fetcher,cache:null,boundedJson,now}),body=await failed.text();assert.ok(!body.includes(secret));assert.equal(JSON.parse(body).reason,'CONNECTION_ERROR');assert.equal(calls,1);
});
test('provider 204 means no station uploads and never attempts to parse an empty body',async()=>{
 let parsed=false;const stored=[];
 const result=await stationCurrent(request(),env,{now,fetcher:async()=>new Response(null,{status:204}),boundedJson:async()=>{parsed=true;throw Error('Empty body');},cache:{match:async()=>undefined,put:async(key,response)=>stored.push(response)}});
 assert.equal((await result.json()).reason,'NO_OBSERVATIONS');assert.equal(parsed,false);assert.equal(stored.length,1);assert.equal(stored[0].headers.get('Cache-Control'),'public, max-age=60');
});

test('Access protection precedes station reads, and weather never opens D1',async()=>{
 const denial=new AccessDenied();const locked=createPrivateWorker({verify:async()=>{throw denial;}});
 assert.equal((await locked.fetch(request(),env,{})).status,403);
 const protectedSite=createPrivateWorker({verify:async()=>({email:'owner@example.test'})});
 const settings={FRONTEND_ORIGIN:origin,BUDGET_DB:new Proxy({},{get(){throw Error('Weather must not use D1');}})};
 const result=await protectedSite.fetch(request(),settings,{});assert.equal(result.status,200);assert.match(result.headers.get('Cache-Control'),/private, no-store/);assert.equal((await result.json()).reason,'NOT_CONFIGURED');
});
test('weather source selection survives settings normalization and defaults to the requested station',()=>{
 assert.equal(normalizeSettings().weatherSource,'station');assert.equal(normalizeSettings({weatherSource:'regional'}).weatherSource,'regional');assert.equal(normalizeSettings({weatherSource:'untrusted'}).weatherSource,'station');
});

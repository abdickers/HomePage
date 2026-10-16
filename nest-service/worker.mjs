// Personal Nest gateway. No Google credentials or raw Google tokens reach GitHub Pages.
const trait = (d, name) => d.traits?.['sdm.devices.traits.' + name] || {};
const enc = new TextEncoder();
const random = () => Array.from(crypto.getRandomValues(new Uint8Array(32)), b => b.toString(16).padStart(2,'0')).join('');
const hash = async value => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',enc.encode(value))),b=>b.toString(16).padStart(2,'0')).join('');
class Failure extends Error { constructor(status,message){super(message);this.status=status;} }
const fail = (status,message) => {throw new Failure(status,message);};
export async function boundedJson(response, limit=262144) {
 const reader=response.body?.getReader(); if(!reader)fail(502,'Empty provider response.');
 let size=0,parts=[];try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>limit){await reader.cancel();fail(502,'Provider response exceeded the size limit.');}parts.push(value);}}finally{reader.releaseLock();}
 const bytes=new Uint8Array(size);let offset=0;for(const part of parts){bytes.set(part,offset);offset+=part.length;}
 try{return JSON.parse(new TextDecoder().decode(bytes));}catch{fail(502,'Invalid provider response.');}
}
async function key(env){return crypto.subtle.importKey('raw',Uint8Array.from(atob(env.TOKEN_ENCRYPTION_KEY),c=>c.charCodeAt(0)),{name:'AES-GCM'},false,['encrypt','decrypt']);}
async function seal(env,value){const iv=crypto.getRandomValues(new Uint8Array(12));const bytes=new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv},await key(env),enc.encode(JSON.stringify(value))));return JSON.stringify({iv:btoa(String.fromCharCode(...iv)),data:btoa(String.fromCharCode(...bytes))});}
async function unseal(env,value){const v=JSON.parse(value);return JSON.parse(new TextDecoder().decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:Uint8Array.from(atob(v.iv),c=>c.charCodeAt(0))},await key(env),Uint8Array.from(atob(v.data),c=>c.charCodeAt(0)))));}
async function getRecord(env,id){const raw=await env.NEST_KV.get(id);return raw?unseal(env,raw):null;}
async function putRecord(env,id,value,ttl){await env.NEST_KV.put(id,await seal(env,value),ttl?{expirationTtl:ttl}:{});}
async function provider(url,options={}){
 let r;try{r=await fetch(url,{...options,signal:AbortSignal.timeout(15000),redirect:'error'});}catch{fail(502,'Google could not be reached. Retry in a moment.');}
 const body=await boundedJson(r);
 if(!r.ok){const reason=body.error?.status||body.error;
  if(r.status===401||reason==='invalid_grant')fail(401,'Google authorization expired. Reconnect Nest.');
  if(r.status===403)fail(403,'Google denied device access. Check SDM API and selected Nest permissions.');
  if(r.status===429)fail(429,'Nest is rate limiting requests. Wait before trying again.');
  fail(502,'Nest could not complete this request. Check device state and retry.');}
 return body;
}
async function exchange(env,fields){return provider('https://oauth2.googleapis.com/token',{method:'POST',body:new URLSearchParams({client_id:env.GOOGLE_CLIENT_ID,client_secret:env.GOOGLE_CLIENT_SECRET,...fields})});}
async function access(env){const record=await getRecord(env,'owner');if(!record)fail(401,'Connect your personal Nest account first.');
 if(record.expires>Date.now()+60000)return record.access;
 const result=await exchange(env,{grant_type:'refresh_token',refresh_token:record.refresh});
 record.access=result.access_token;record.expires=Date.now()+result.expires_in*1000;await putRecord(env,'owner',record);return record.access;
}
async function sdm(env,path,body){return provider('https://smartdevicemanagement.googleapis.com/v1/'+path,{headers:{Authorization:'Bearer '+await access(env),...(body?{'Content-Type':'application/json'}:{})},...(body?{method:'POST',body:JSON.stringify(body)}:{})});}
export function presentDevice(d){return {id:d.name.split('/').pop(),name:trait(d,'Info').customName||d.parentRelations?.[0]?.displayName||'Nest device',type:d.type?.split('.').pop(),online:trait(d,'Connectivity').status||'UNKNOWN',temperature:trait(d,'Temperature').ambientTemperatureCelsius,humidity:trait(d,'Humidity').ambientHumidityPercent,scale:trait(d,'Settings').temperatureScale||'FAHRENHEIT',mode:trait(d,'ThermostatMode').mode,modes:trait(d,'ThermostatMode').availableModes||[],eco:trait(d,'ThermostatEco').mode,hvac:trait(d,'ThermostatHvac').status,setpoint:trait(d,'ThermostatTemperatureSetpoint'),protocols:trait(d,'CameraLiveStream').supportedProtocols||[]};}
export function thermostatCommand(d,input){
 if(d.type!=='sdm.devices.types.THERMOSTAT')fail(400,'Choose a thermostat.');
 if(trait(d,'Connectivity').status!=='ONLINE')fail(409,'Thermostat is not online.');
 if(input.action==='mode'){
  if(!['HEAT','COOL','HEATCOOL','OFF'].includes(input.mode)||!trait(d,'ThermostatMode').availableModes?.includes(input.mode))fail(400,'Unsupported thermostat mode.');
  return {command:'sdm.devices.commands.ThermostatMode.SetMode',params:{mode:input.mode}};
 }
 if(input.action!=='setpoint')fail(400,'Unsupported action.');
 if(trait(d,'ThermostatEco').mode==='MANUAL_ECO')fail(409,'Use Google Home to leave Eco mode before adjusting temperature.');
 const mode=trait(d,'ThermostatMode').mode;
 const fields=mode==='HEAT'?['heatCelsius']:mode==='COOL'?['coolCelsius']:mode==='HEATCOOL'?['heatCelsius','coolCelsius']:[];
 if(!fields.length)fail(409,'Choose Heat, Cool, or Heat/Cool before setting a temperature.');
 const params={};for(const field of fields){const value=input[field];if(typeof value!=='number'||!Number.isFinite(value)||value<10||value>32)fail(400,'Set temperatures between 50 and 89.6 °F (10–32 °C).');params[field]=Math.round(value*10)/10;}
 if(mode==='HEATCOOL'&&params.coolCelsius-params.heatCelsius<1.7)fail(400,'Keep at least 3 °F between heating and cooling targets.');
 return {command:'sdm.devices.commands.ThermostatTemperatureSetpoint.'+(mode==='HEAT'?'SetHeat':mode==='COOL'?'SetCool':'SetRange'),params};
}
function headers(env){return {'Content-Type':'application/json','Cache-Control':'no-store','Access-Control-Allow-Origin':env.FRONTEND_ORIGIN,'Access-Control-Allow-Methods':'GET, POST, OPTIONS','Access-Control-Allow-Headers':'Authorization, Content-Type','Vary':'Origin','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff'};}
function ready(env){return Boolean(env.NEST_KV&&env.GOOGLE_CLIENT_ID&&env.GOOGLE_CLIENT_SECRET&&env.TOKEN_ENCRYPTION_KEY);}
async function authorize(request,env){
 if(request.headers.get('Origin')!==env.FRONTEND_ORIGIN)fail(403,'Untrusted dashboard origin.');
 const bearer=request.headers.get('Authorization')?.match(/^Bearer ([a-f0-9]{64})$/)?.[1];if(!bearer)fail(401,'Sign in to your personal Nest account.');
 const id=await hash(bearer),session=await getRecord(env,'session:'+id);if(!session||session.expires<Date.now())fail(401,'Nest session expired. Reconnect.');return id;
}
async function device(env,id){if(!/^[A-Za-z0-9_-]{1,256}$/.test(id||''))fail(400,'Invalid device.');return sdm(env,`enterprises/${env.NEST_PROJECT_ID}/devices/${id}`);}
function page(env,message,session){const nonce=random();const payload=JSON.stringify({type:'sage-nest-connected',session}).replaceAll('<','\\u003c');return new Response(`<!doctype html><meta name="viewport" content="width=device-width"><title>Bag End · Nest</title><style nonce="${nonce}">body{font:18px system-ui;background:#101c18;color:#eadba2;margin:10vh auto;max-width:580px;padding:24px}a{color:inherit}</style><h1>⌂ Bag End</h1><p>${message}</p><a href="${env.FRONTEND_ORIGIN}/HomePage/${session?'#nest-session='+session:''}">Return to your dashboard</a>${session?`<script nonce="${nonce}">if(window.opener){window.opener.postMessage(${payload},${JSON.stringify(env.FRONTEND_ORIGIN)});window.close();}</script>`:''}`,{headers:{'Content-Type':'text/html;charset=UTF-8','Cache-Control':'no-store','Referrer-Policy':'no-referrer','Content-Security-Policy':`default-src 'none'; style-src 'nonce-${nonce}'; script-src 'nonce-${nonce}'; frame-ancestors 'none'; base-uri 'none'`}});}
export default {async fetch(request,env){
 const url=new URL(request.url);let response;
 try{
  if(url.pathname==='/health')return new Response(JSON.stringify({service:'sage-cabin',configured:ready(env)}),{headers:headers(env)});
  if(request.method==='OPTIONS'){if(request.headers.get('Origin')!==env.FRONTEND_ORIGIN)fail(403,'Untrusted dashboard origin.');return new Response(null,{status:204,headers:headers(env)});}
  if(!ready(env))fail(503,'Nest service setup is incomplete. Server credentials are still needed.');
  if(url.pathname==='/auth/start'&&request.method==='GET'){
   const state=random();const auth=new URL(`https://nestservices.google.com/partnerconnections/${env.NEST_PROJECT_ID}/auth`);
   // PCM supplies its own login_hint after account selection; forwarding one duplicates it.
   for(const [k,v]of Object.entries({client_id:env.GOOGLE_CLIENT_ID,redirect_uri:url.origin+'/auth/callback',response_type:'code',scope:'openid email https://www.googleapis.com/auth/sdm.service',access_type:'offline',prompt:'consent',state}))auth.searchParams.set(k,v);
   await putRecord(env,'state:'+await hash(state),{expires:Date.now()+600000},600);
   return new Response(null,{status:302,headers:{Location:auth.href,'Set-Cookie':`__Host-nest-state=${state}; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=600`,'Cache-Control':'no-store','Referrer-Policy':'no-referrer'}});
  }
  if(url.pathname==='/auth/callback'&&request.method==='GET'){
   const state=url.searchParams.get('state')||'',cookie=request.headers.get('Cookie')?.match(/(?:^|; )__Host-nest-state=([a-f0-9]{64})(?:;|$)/)?.[1];
   if(!/^[a-f0-9]{64}$/.test(state)||!cookie||await hash(state)!==await hash(cookie))fail(400,'Authorization state did not match. Start again from Bag End.');
   const record=await getRecord(env,'state:'+await hash(state));if(!record||record.expires<Date.now())fail(400,'Authorization expired. Start again.');await env.NEST_KV.delete('state:'+await hash(state));
   if(url.searchParams.has('error'))return page(env,'Google access was declined. No devices were connected.');
   const code=url.searchParams.get('code');if(!code||code.length>4096)fail(400,'Missing authorization code.');
   const result=await exchange(env,{code,grant_type:'authorization_code',redirect_uri:url.origin+'/auth/callback'});
   const who=await provider('https://openidconnect.googleapis.com/v1/userinfo',{headers:{Authorization:'Bearer '+result.access_token}});
   if(who.email_verified!==true||who.email?.toLowerCase()!==env.OWNER_EMAIL.toLowerCase())fail(403,'Use the personal Google account assigned to this dashboard.');
   // Verify real device access before storing credentials or issuing an app session.
   await provider(`https://smartdevicemanagement.googleapis.com/v1/enterprises/${env.NEST_PROJECT_ID}/devices`,{headers:{Authorization:'Bearer '+result.access_token}});
   const previous=await getRecord(env,'owner');if(!result.refresh_token&&!previous?.refresh)fail(401,'Google did not grant offline access. Reconnect with consent.');
   await putRecord(env,'owner',{access:result.access_token,refresh:result.refresh_token||previous.refresh,expires:Date.now()+result.expires_in*1000});
   const session=random();await putRecord(env,'session:'+await hash(session),{expires:Date.now()+8*3600000},8*3600);
   response=page(env,'Your personal Nest connection is ready. Return to Bag End.',session);response.headers.set('Set-Cookie','__Host-nest-state=; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=0');return response;
  }
  const session=await authorize(request,env);
  if(url.pathname==='/devices'&&request.method==='GET'){
   const result=await sdm(env,`enterprises/${env.NEST_PROJECT_ID}/devices`);return new Response(JSON.stringify({devices:(result.devices||[]).map(presentDevice),updatedAt:new Date().toISOString()}),{headers:headers(env)});
  }
  if(request.method!=='POST')fail(404,'Unknown endpoint.');
  if(!request.headers.get('Content-Type')?.startsWith('application/json'))fail(415,'Use JSON.');
  const input=await boundedJson(request,65536);
  if(url.pathname==='/disconnect'){await env.NEST_KV.delete('session:'+session);return new Response('{}',{headers:headers(env)});}
  const d=await device(env,input.deviceId);let command;
  if(url.pathname==='/thermostat')command=thermostatCommand(d,input);
  else if(url.pathname==='/camera/start'){
   if(!trait(d,'CameraLiveStream').supportedProtocols?.includes('WEB_RTC'))fail(409,'This camera requires an RTSP gateway. Open Google Home to view it.');
   if(typeof input.offerSdp!=='string'||input.offerSdp.length>60000||!input.offerSdp.startsWith('v=0')||!input.offerSdp.endsWith('\n'))fail(400,'Invalid camera offer.');
   command={command:'sdm.devices.commands.CameraLiveStream.GenerateWebRtcStream',params:{offerSdp:input.offerSdp}};
  }else if(url.pathname==='/camera/stop'){
   if(typeof input.mediaSessionId!=='string'||input.mediaSessionId.length>2048)fail(400,'Invalid camera session.');
   const stream=await getRecord(env,'stream:'+session);if(!stream||stream.deviceId!==input.deviceId||stream.mediaSessionId!==input.mediaSessionId)fail(403,'Camera session does not belong to this connection.');
   command={command:'sdm.devices.commands.CameraLiveStream.StopWebRtcStream',params:{mediaSessionId:input.mediaSessionId}};
  }else fail(404,'Unknown endpoint.');
  const result=await sdm(env,d.name+':executeCommand',command);
  if(url.pathname==='/camera/start'){
   const r=result.results||{};await putRecord(env,'stream:'+session,{deviceId:input.deviceId,mediaSessionId:r.mediaSessionId},300);
   return new Response(JSON.stringify({answerSdp:r.answerSdp,mediaSessionId:r.mediaSessionId,expiresAt:r.expiresAt}),{headers:headers(env)});
  }
  if(url.pathname==='/camera/stop')await env.NEST_KV.delete('stream:'+session);
  return new Response('{}',{headers:headers(env)});
 }catch(error){const known=error instanceof Failure;return new Response(JSON.stringify({error:known?error.message:'Nest service encountered an error. Please retry.'}),{status:known?error.status:500,headers:headers(env)});}
}};

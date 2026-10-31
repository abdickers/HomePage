import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPair,exportSPKI,compactDecrypt} from 'jose';
import {nativeHome} from '../nest-service/native-home.mjs';
import gateway,{createNativeNestSession} from '../nest-service/worker.mjs';
import {createPrivateWorker} from '../nest-service/private-worker.mjs';

const origin='https://sage-cabin-nest.nest-service.workers.dev';
const pair=await generateKeyPair('RSA-OAEP-256',{modulusLength:2048,extractable:true});
const pem=await exportSPKI(pair.publicKey),key=Buffer.from(pem.replace(/-----[^-]+-----|\s/g,''),'base64').toString('base64url');
const state='a'.repeat(64),now=1793458800000,identity={email:'abdickers@gmail.com',expiresAt:now+3600000};
function setup(){const values=new Map();return {FRONTEND_ORIGIN:origin,OWNER_EMAIL:identity.email,NEST_KV:{get:async k=>values.get(k)||null,put:async(k,v)=>values.set(k,v),delete:async k=>values.delete(k)},values};}
const start=()=>new Request(origin+'/native/home?'+new URLSearchParams({state,key}));
const approve=(csrf,options={})=>new Request(origin+'/native/home',{method:'POST',headers:{Origin:origin,'Content-Type':'application/x-www-form-urlencoded',Cookie:'__Host-native-home='+csrf,'Cf-Access-Jwt-Assertion':'SYNTHETIC.ACCESS.JWT',...options.headers},body:new URLSearchParams({state,csrf,...options.fields})});
const dependencies={now,createSession:async()=>({token:'b'.repeat(64),expires:now+86400000})};
test('Home approval returns only ciphertext decryptable by the initiating phone',async()=>{
 const env=setup(),begin=await nativeHome(start(),env,identity,dependencies),csrf=begin.headers.get('Set-Cookie').match(/__Host-native-home=([a-f0-9]{64})/)[1];assert.equal(begin.status,200);assert.match(await begin.text(),/Connect this phone/);
 const response=await nativeHome(approve(csrf),env,identity,dependencies),html=await response.text();assert.equal(response.status,200);assert.doesNotMatch(html,/SYNTHETIC\.ACCESS\.JWT|b{64}/);const compact=html.match(/&amp;response=([A-Za-z0-9_.-]+)/)[1];
 const payload=JSON.parse(new TextDecoder().decode((await compactDecrypt(compact,pair.privateKey)).plaintext));assert.equal(payload.state,state);assert.equal(payload.email,identity.email);assert.equal(payload.accessJwt,'SYNTHETIC.ACCESS.JWT');assert.equal(payload.expiresAt,now+120000);assert.equal(payload.session,'b'.repeat(64));assert.equal(env.values.size,0);
 const other=await generateKeyPair('RSA-OAEP-256');await assert.rejects(compactDecrypt(compact,other.privateKey));
 assert.equal((await nativeHome(approve(csrf),env,identity,dependencies)).status,403);
});
test('work identity, cross-origin, missing browser state, expired and malformed requests fail closed',async()=>{
 const env=setup();assert.equal((await nativeHome(start(),env,{...identity,email:'dickersona@76fireworks.com'},dependencies)).status,403);assert.equal(env.values.size,0);
 const response=await nativeHome(start(),env,identity,dependencies),csrf=response.headers.get('Set-Cookie').match(/__Host-native-home=([a-f0-9]{64})/)[1];
 for(const options of [{headers:{Origin:'https://attacker.invalid'}},{headers:{Origin:'null'}},{headers:{Origin:''}},{headers:{Cookie:''}},{fields:{redirect_uri:'https://attacker.invalid'}},{fields:{csrf:'c'.repeat(64)}}])assert.ok((await nativeHome(approve(csrf,options),env,identity,dependencies)).status>=400);
 assert.equal((await nativeHome(approve(csrf),env,identity,{...dependencies,now:now+300001})).status,403);
 assert.equal((await nativeHome(new Request(origin+'/native/home?state=x&key=x'),env,identity,dependencies)).status,400);
});
test('private wrapper preserves the native form Origin policy without changing other private pages',async()=>{
 const env=setup(),app=createPrivateWorker({verify:async()=>identity,service:{fetch:async()=>new Response('synthetic private response')}});
 const approval=await app.fetch(start(),env);assert.equal(approval.status,200);assert.equal(approval.headers.get('Referrer-Policy'),'same-origin');assert.match(approval.headers.get('Content-Security-Policy'),/form-action 'self'/);assert.match(approval.headers.get('Cache-Control'),/no-store/);
 const ordinary=await app.fetch(new Request(origin+'/devices'),env);assert.equal(ordinary.headers.get('Referrer-Policy'),'no-referrer');
 const csrf=approval.headers.get('Set-Cookie').match(/__Host-native-home=([a-f0-9]{64})/)[1];
 const forged=await app.fetch(approve(csrf,{headers:{Origin:'null'}}),env);assert.equal(forged.status,403);assert.match(await forged.text(),/Untrusted connection/);
});
test('native session is separately encrypted, scoped to Nest, and needs an existing owner grant',async()=>{
 const env={...setup(),TOKEN_ENCRYPTION_KEY:Buffer.alloc(32,7).toString('base64'),GOOGLE_CLIENT_ID:'synthetic-client',GOOGLE_CLIENT_SECRET:'synthetic-secret'};
 await assert.rejects(createNativeNestSession(env,identity.email),/Connect Nest/);
 await assert.rejects(createNativeNestSession(env,'dickersona@76fireworks.com'),/personal owner/);
 const aes=await crypto.subtle.importKey('raw',Buffer.alloc(32,7),{name:'AES-GCM'},false,['encrypt']),iv=crypto.getRandomValues(new Uint8Array(12));
 const encrypted=await crypto.subtle.encrypt({name:'AES-GCM',iv},aes,new TextEncoder().encode(JSON.stringify({access:'SYNTHETIC-NOT-A-PROVIDER-TOKEN',refresh:'SYNTHETIC-NOT-A-REFRESH-TOKEN'})));
 env.values.set('owner',JSON.stringify({iv:Buffer.from(iv).toString('base64'),data:Buffer.from(encrypted).toString('base64')}));
 const session=await createNativeNestSession(env,identity.email);assert.match(session.token,/^[a-f0-9]{64}$/);assert.equal(env.values.size,2);assert.ok(![...env.values.values()].some(value=>value.includes(session.token)));
 const request=path=>new Request(origin+path,{headers:{Origin:origin,Authorization:'Bearer '+session.token}});
 assert.equal((await gateway.fetch(request('/native/session'),env)).status,200);
 assert.equal((await gateway.fetch(request('/google/session'),env)).status,401);
 assert.equal((await gateway.fetch(request('/native/arbitrary'),env)).status,403);
});

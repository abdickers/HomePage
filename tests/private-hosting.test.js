import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPair,exportJWK,createLocalJWKSet,SignJWT} from 'jose';
import {SITE_EMAILS,verifySiteAccess} from '../nest-service/access-guard.mjs';
import {createPrivateWorker} from '../nest-service/private-worker.mjs';

const origin='https://sage-cabin-nest.nest-service.workers.dev';
const env={FRONTEND_ORIGIN:origin,ACCESS_TEAM_DOMAIN:'https://sage-command-center.cloudflareaccess.com',ACCESS_AUD:'a'.repeat(64)};
const pair=await generateKeyPair('RS256');
const key=await exportJWK(pair.publicKey);key.kid='test-key';key.alg='RS256';
const keySet=createLocalJWKSet({keys:[key]});
const verify=(request,settings)=>verifySiteAccess(request,settings,{keySet});
const token=async(email=SITE_EMAILS[0],claims={})=>new SignJWT({email,type:'app',...claims})
  .setProtectedHeader({alg:'RS256',kid:key.kid}).setSubject('synthetic-test-user')
  .setIssuer(claims.iss||env.ACCESS_TEAM_DOMAIN).setAudience(claims.aud||env.ACCESS_AUD)
  .setIssuedAt().setExpirationTime(claims.exp??'1h').sign(pair.privateKey);
const request=(path,proof,options={})=>new Request(origin+path,{...options,headers:{...(proof?{'Cf-Access-Jwt-Assertion':proof}:{}),...options.headers}});

test('signed Access assertions admit exactly the two approved email identities',async()=>{
  for(const email of SITE_EMAILS){const result=await verify(request('/HomePage/',await token(email)),env);assert.equal(result.email,email);assert.ok(result.expiresAt>Date.now());}
  await assert.rejects(verify(request('/HomePage/',await token('another@76fireworks.com')),env),{status:403});
  await assert.rejects(verify(request('/HomePage/',null,{headers:{'Cf-Access-Authenticated-User-Email':SITE_EMAILS[0]}}),env),{status:403});
});

test('wrong audience/issuer, expired, altered and non-app JWTs are rejected',async()=>{
  for(const claims of [{aud:'b'.repeat(64)},{iss:'https://another.cloudflareaccess.com'},{exp:Math.floor(Date.now()/1000)-30},{type:'service'}]){
    await assert.rejects(verify(request('/HomePage/',await token(SITE_EMAILS[0],claims)),env),{status:403});
  }
  const original=await token();const pieces=original.split('.');
  pieces[1]=Buffer.from(JSON.stringify({email:SITE_EMAILS[1],type:'app',aud:env.ACCESS_AUD,iss:env.ACCESS_TEAM_DOMAIN,sub:'forged',exp:9999999999,iat:1})).toString('base64url');
  await assert.rejects(verify(request('/HomePage/',pieces.join('.')),env),{status:403});
  const symmetric=await new SignJWT({email:SITE_EMAILS[0],type:'app'}).setProtectedHeader({alg:'HS256'}).setIssuer(env.ACCESS_TEAM_DOMAIN).setAudience(env.ACCESS_AUD).setSubject('forged').setIssuedAt().setExpirationTime('1h').sign(new TextEncoder().encode('synthetic-key-for-test-only-12345'));
  await assert.rejects(verify(request('/HomePage/',symmetric),env),{status:403});
});

test('missing or unsafe Access configuration fails closed before assets or gateway execution',async()=>{
  let calls=0;const app=createPrivateWorker({verify,service:{fetch(){calls++;return new Response('private');}}});
  const assets={fetch(){calls++;return new Response('private');}};
  for(const settings of [{...env,ACCESS_AUD:''},{...env,ACCESS_TEAM_DOMAIN:'https://evil.test'},{...env,ACCESS_TEAM_DOMAIN:env.ACCESS_TEAM_DOMAIN+'/unexpected'}]){
    const response=await app.fetch(request('/HomePage/',await token()),{...settings,ASSETS:assets});assert.equal(response.status,503);
  }
  assert.equal(calls,0);
});

test('dashboard HTML, scripts, images, release metadata and every API require Access',async()=>{
  let calls=0;const app=createPrivateWorker({verify,service:{fetch(){calls++;return new Response('private');}}});
  for(const path of ['/','/HomePage/','/HomePage/js/app.js','/HomePage/assets/sigil.svg','/HomePage/release.json','/health','/google/session','/devices','/budget/snapshot','/auth/start','/auth/callback']){
    const response=await app.fetch(request(path),{...env,ASSETS:{fetch(){calls++;return new Response('private');}}});
    assert.equal(response.status,403,path);assert.doesNotMatch(await response.text(),/private.*records|Bearer|session=/);
  }
  assert.equal(calls,0);
});

test('private HTML has a fresh CSP nonce, no-store and anti-framing headers',async()=>{
  const seen=[];const app=createPrivateWorker({verify,rewrite(response,nonce){seen.push(nonce);return response;}});
  const settings={...env,ASSETS:{fetch:()=>new Response('<h1>Private app</h1>',{headers:{'Content-Type':'text/html','Cache-Control':'public,max-age=31536000'}})}};
  const proof=await token();
  for(let i=0;i<2;i++){
    const response=await app.fetch(request('/HomePage/',proof),settings);
    assert.equal(response.status,200);assert.match(response.headers.get('Cache-Control'),/private, no-store/);
    assert.equal(response.headers.get('X-Frame-Options'),'DENY');assert.match(response.headers.get('Content-Security-Policy'),/frame-ancestors 'none'/);
    assert.match(response.headers.get('Content-Security-Policy'),new RegExp('nonce-'+seen.at(-1)));
    assert.match(response.headers.get('X-Robots-Tag'),/noindex/);
  }
  assert.notEqual(seen[0],seen[1]);
});

test('private assets reject writes, and signed tokens cannot be reused on alternate hosts',async()=>{
  let calls=0;const app=createPrivateWorker({verify});const settings={...env,ASSETS:{fetch(){calls++;return new Response('asset');}}};const proof=await token();
  assert.equal((await app.fetch(request('/HomePage/js/app.js',proof,{method:'POST'}),settings)).status,405);
  assert.equal((await app.fetch(new Request('https://other.workers.dev/HomePage/',{headers:{'Cf-Access-Jwt-Assertion':proof}}),settings)).status,403);
  assert.equal(calls,0);
});

test('same-origin browser GETs retain origin checks and the existing app-session requirement',async()=>{
  const app=createPrivateWorker({verify});const proof=await token();
  const settings={...env,NEST_KV:{get:async()=>null},GOOGLE_CLIENT_ID:'synthetic',GOOGLE_CLIENT_SECRET:'synthetic',TOKEN_ENCRYPTION_KEY:'synthetic'};
  const sameOrigin=await app.fetch(request('/google/session',proof,{headers:{'Sec-Fetch-Site':'same-origin'}}),settings);
  assert.equal(sameOrigin.status,401);assert.match((await sameOrigin.json()).error,/Sign in/);
  for(const options of [{},{headers:{Origin:'https://abdickers.github.io','Sec-Fetch-Site':'cross-site'}},{method:'POST',headers:{'Sec-Fetch-Site':'same-origin'}}]){
    const response=await app.fetch(request('/google/disconnect',proof,options),settings);assert.equal(response.status,403);
  }
});

test('only the exact POST webhook bypasses Access and still delegates to signature validation',async()=>{
  const calls=[];const app=createPrivateWorker({verify,service:{fetch(req){calls.push(req.url);return Response.json({error:'Invalid webhook signature'},{status:401});}}});
  const response=await app.fetch(request('/budget/plaid/webhook',null,{method:'POST',body:'{}'}),env);
  assert.equal(response.status,401);assert.equal(calls.length,1);
  for(const path of ['/budget/plaid/webhook','/budget/plaid/webhook/','/budget/plaid/webhook/snapshot']){
    assert.equal((await app.fetch(request(path,null,{method:path.endsWith('webhook')?'GET':'POST'}),env)).status,403);
  }
  assert.equal(calls.length,1);
});

test('private host redirects retain the case-sensitive app path and scheduled sync remains internal',async()=>{
  let count=0;const app=createPrivateWorker({verify,service:{scheduled(){count++;}}});const proof=await token();
  for(const path of ['/','/HomePage']){const response=await app.fetch(request(path,proof),env);assert.equal(response.headers.get('Location'),origin+'/HomePage/');}
  const response=await app.fetch(request('/__access/session',proof),env);assert.deepEqual(Object.keys(await response.json()).sort(),['email','expiresAt']);
  await app.scheduled({},env,{});assert.equal(count,1);
});

test('live public feed snapshots stay behind Access and never receive user headers or query strings',async()=>{
  const calls=[];let fallback=0;
  const app=createPrivateWorker({verify,publicFetch:async(url,options)=>{calls.push({url,options});return Response.json({source:'public fixture',items:[]});}});
  const settings={...env,ASSETS:{fetch(){fallback++;return Response.json({source:'packaged fixture'});}}};
  assert.equal((await app.fetch(request('/HomePage/data/news.json'),settings)).status,403);assert.equal(calls.length,0);
  const response=await app.fetch(request('/HomePage/data/news.json?secret=never-forward',await token(),{headers:{Cookie:'private-cookie',Authorization:'Bearer private-app-session'}}),settings);
  assert.equal(response.status,200);assert.equal(calls[0].url,'https://raw.githubusercontent.com/abdickers/HomePage/main/data/news.json');
  assert.deepEqual(calls[0].options.headers,{Accept:'application/json'});assert.equal(fallback,0);
  const offline=createPrivateWorker({verify,publicFetch:async()=>{throw Error('offline');}});
  assert.equal((await (await offline.fetch(request('/HomePage/data/wow.json',await token()),settings)).json()).source,'packaged fixture');
  assert.equal(fallback,1);
});

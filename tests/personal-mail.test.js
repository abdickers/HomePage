import test from 'node:test';
import assert from 'node:assert/strict';
import {initPersonalMail,googleReadError} from '../js/personal-mail.js';
const tick=()=>new Promise(setImmediate);
function fixture({email='abdickers@gmail.com',closed=false}={}){
 const elements=new Map();
 const element=id=>{if(!elements.has(id))elements.set(id,{textContent:'',innerHTML:'',hidden:false,disabled:false,listeners:{},addEventListener(name,fn){this.listeners[name]=fn;},replaceChildren(){this.innerHTML='';},setAttribute(name,value){this[name]=value;}});return elements.get(id);};
 const tabs=['primary','updates'].map(category=>({...element(category),dataset:{inbox:category}}));
 global.document={getElementById:element,querySelectorAll:()=>tabs};
 const calls=[],grants=[];
 global.google={accounts:{oauth2:{hasGrantedAllScopes:()=>true,initTokenClient:config=>{
  grants.push(config);
  return Object.freeze({requestAccessToken(){if(closed)config.error_callback({type:'popup_closed'});else config.callback({access_token:'test-token-not-a-real-secret',expires_in:3600});}});
 }}}};global.window={google:global.google};
 global.fetch=async (url,options)=>{
  calls.push({url:String(url),options});let data;
  if(String(url).includes('userinfo'))data={email,email_verified:true};
  else if(String(url).endsWith('/profile'))data={emailAddress:email};
  else if(String(url).includes('/messages?'))data={messages:[{id:'abc'}],resultSizeEstimate:1};
  else data={id:'abc',threadId:'aabb',internalDate:'1792000000000',snippet:'Real fixture content',payload:{headers:[{name:'From',value:'Person <person@example.com>'},{name:'Subject',value:'<script>never execute</script>'}]}};
  return {ok:true,json:async()=>data};
 };
 return {element,tabs,calls,grants};
}
test('personal controller verifies the account before reading category messages, and disconnect clears them',async()=>{
 const f=fixture();const session=initPersonalMail(()=> 'public-client-id');await tick();
 assert.equal(f.element('mailConnect').disabled,false);
 assert.equal(f.element('receiptsConnect').disabled,true);
 f.element('receiptsConnect').listeners.click();await tick();
 assert.equal(f.calls.length,0);assert.equal(f.grants.length,1);
 f.element('mailConnect').listeners.click();await tick();
 assert.match(f.element('ravensList').innerHTML,/&lt;script&gt;never execute&lt;\/script&gt;/);
 assert.match(f.element('ravensList').innerHTML,/authuser=abdickers%40gmail.com/);
 const query=f.calls.find(c=>c.url.includes('/messages?')).url;assert.equal(new URL(query).searchParams.get('q'),'in:inbox category:primary is:unread');
 assert.match(f.grants[0].scope,/gmail\.readonly/);assert.doesNotMatch(f.grants[0].scope,/gmail\.modify|gmail\.send/);
 session.disconnect();assert.equal(f.element('ravensList').innerHTML,'');assert.equal(f.element('mailRefresh').disabled,true);await tick();
});
test('wrong Google account cannot trigger any inbox or receipt read',async()=>{
 const f=fixture({email:'dickersona@76fireworks.com'});initPersonalMail(()=> 'public-client-id');await tick();
 f.element('mailConnect').listeners.click();await tick();
 assert.equal(f.calls.filter(c=>c.url.includes('/messages')).length,0);assert.match(f.element('ravensState').textContent,/Use abdickers@gmail.com/);assert.equal(f.element('mailConnect').disabled,false);
});
test('closing the Google popup clears the pending grant and permits retry',async()=>{
 const f=fixture({closed:true});initPersonalMail(()=> 'public-client-id');await tick();
 f.element('mailConnect').listeners.click();await tick();
 assert.match(f.element('ravensState').textContent,/Sign-in closed/);assert.equal(f.element('receiptsConnect').disabled,true);assert.equal(f.element('mailConnect').disabled,false);assert.equal(f.calls.length,0);
});
test('a remembered private Google connection restores the inbox without requesting a browser OAuth token',async()=>{
 const f=fixture();let connected=true,changed;
 const connection={ready:async()=>{},connected:()=>connected,sessionId:()=> 'd'.repeat(64),expiresAt:()=>Date.now()+100000,connect:async()=>{},read:async url=>(await global.fetch(url)).json(),subscribe:listener=>{changed=listener;},disconnect:()=>{connected=false;changed(false);}};
 const controller=initPersonalMail(()=> 'public-client-id',connection);await tick();await tick();
 assert.equal(f.grants.length,0);assert.match(f.element('ravensList').innerHTML,/Real fixture content/);assert.equal(f.element('mailRefresh').disabled,false);
 controller.disconnect();assert.equal(f.element('ravensList').innerHTML,'');assert.equal(f.element('mailRefresh').disabled,true);await tick();
});

test('Google API failures distinguish disabled API, missing scopes, policy and rate limits without exposing provider text',()=>{
 const url='https://gmail.googleapis.com/gmail/v1/users/me/profile';
 assert.match(googleReadError(403,{error:{details:[{reason:'SERVICE_DISABLED',metadata:{consumer:'projects/123456'}}]}},url),/disabled in Google Cloud project 123456/);
 assert.match(googleReadError(403,{error:{errors:[{reason:'insufficientPermissions'}]}},url),/read-only Gmail scope/);
 assert.match(googleReadError(403,{error:{errors:[{reason:'domainPolicy'}]}},url),/account policy/);
 assert.match(googleReadError(403,{error:{errors:[{reason:'userRateLimitExceeded'}]}},url),/limiting requests/);
 assert.match(googleReadError(403,{error:{errors:[{reason:'dailyLimitExceeded'}]}},url),/daily API quota/);
 assert.match(googleReadError(403,null,url),/Gmail rejected.*403/);
 assert.match(googleReadError(403,null,'https://openidconnect.googleapis.com/v1/userinfo'),/Google identity rejected/);
 assert.doesNotMatch(googleReadError(403,{error:{message:'secret-token-user-email',errors:[{reason:'<script>secret</script>'}]}},url),/secret|script/);
});

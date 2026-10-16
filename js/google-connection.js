import {readSession,rememberSession,forgetSession,sessionKey} from './remembered-session.js';
import {PERSONAL_EMAIL} from './account-links.mjs';

export function createGoogleConnection(serviceUrl,options={}){
 const win=options.window||window,fetcher=options.fetch||fetch;
 let storage=options.storage;try{storage??=win.localStorage;}catch{}
 const url=new URL(serviceUrl);if(url.protocol!=='https:'||url.username||url.password)throw Error('A private HTTPS Google gateway is required.');
 const base=url.origin,saved=readSession(storage,'google',base),listeners=new Set();
 let session=saved?.session||'',expiresAt=saved?.expiresAt||0,verified=false,pending=null,epoch=0,lastError='';
 const connected=()=>verified&&!!session&&Date.now()<expiresAt;
 const emit=()=>{for(const listener of listeners)listener(connected());};
 function clear(){session='';expiresAt=0;verified=false;epoch++;forgetSession(storage,'google');emit();}
 async function request(path,signal){
  const credential=session,attempt=epoch;
  const response=await fetcher(base+path,{headers:{Authorization:'Bearer '+credential},credentials:'omit',cache:'no-store',signal:signal||AbortSignal.timeout(20000)});
  const body=await response.json();
  if(!response.ok){if(response.status===401&&session===credential)clear();const error=Error(typeof body.error==='string'?body.error:'Google could not complete this read.');error.status=response.status;throw error;}
  if(attempt!==epoch||credential!==session)throw Error('Google connection changed. Try again.');
  return body;
 }
 async function verify(){
  if(!session)return;
  const attempt=epoch,credential=session;
  const result=await request('/google/session');
  if(epoch!==attempt||session!==credential)throw Error('Google connection changed. Try again.');
  if(result.email?.toLowerCase()!==PERSONAL_EMAIL||!Number.isFinite(result.expiresAt)||result.expiresAt<=Date.now()){clear();throw Error('Use '+PERSONAL_EMAIL+' for this personal dashboard.');}
  expiresAt=result.expiresAt;verified=true;lastError='';rememberSession(storage,'google',base,session,expiresAt);emit();
 }
 const fragment=new URLSearchParams(win.location.hash.slice(1));
 if(/^[a-f0-9]{64}$/.test(fragment.get('google-session')||'')){
  session=fragment.get('google-session');win.history.replaceState(null,'',win.location.pathname+win.location.search+'#dashboard');
 }
 const ready=verify().catch(error=>{lastError=error.message;});
 function connect(){
  if(connected())return Promise.resolve();
  if(pending)return pending.promise;
  if(session)return verify();
  const popup=win.open(base+'/auth/start?service=google','sagePersonalGoogle','popup,width=620,height=760');
  if(!popup)return Promise.reject(Error('Allow the personal Google sign-in popup, then try again.'));
  let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});
  const timer=setInterval(()=>{if(popup.closed&&pending?.popup===popup){clearInterval(timer);pending=null;reject(Error('Sign-in closed. Connect again when ready.'));}},500);
  pending={popup,promise,resolve,reject,timer};return promise;
 }
 win.addEventListener('message',event=>{
  if(!pending||event.origin!==base||event.source!==pending.popup||event.data?.type!=='sage-google-connected'||!/^[a-f0-9]{64}$/.test(event.data.session||''))return;
  const grant=pending;pending=null;clearInterval(grant.timer);session=event.data.session;epoch++;
  verify().then(grant.resolve,grant.reject);
 });
 win.addEventListener('storage',event=>{
  if(event.key!==sessionKey('google'))return;
  const record=readSession(storage,'google',base);
  if(!record){clear();return;}
  if(record.session!==session){session=record.session;expiresAt=record.expiresAt;verified=false;epoch++;void verify().catch(error=>{lastError=error.message;});}
 });
 function disconnect(){
  const credential=session;
  if(pending){clearInterval(pending.timer);pending.popup.close();pending.reject(Error('Google sign-in cancelled.'));pending=null;}
  clear();
  if(credential)void fetcher(base+'/google/disconnect',{method:'POST',headers:{Authorization:'Bearer '+credential,'Content-Type':'application/json'},body:'{}',credentials:'omit',cache:'no-store',keepalive:true}).catch(()=>{});
 }
 return {ready:()=>ready,connect,disconnect,connected,sessionId:()=>session,expiresAt:()=>expiresAt,error:()=>lastError,
  subscribe(listener){listeners.add(listener);return()=>listeners.delete(listener);},
  read(resource,{signal}={}){if(!connected())return Promise.reject(Error('Connect your personal Google account first.'));return request('/google/read?'+new URLSearchParams({url:resource}),signal);}
 };
}

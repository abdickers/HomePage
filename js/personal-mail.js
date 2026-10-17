import {googleIdentity} from './google-identity.js?v=20261015-personal6';
import {PERSONAL_EMAIL} from './account-links.mjs?v=20261015-personal6';
import {escapeHtml as esc} from './core.js?v=20261015-personal6';
import {INBOX_QUERIES,RECEIPT_QUERY,personalIdentity,uniqueConversations,receiptRecord} from './mail-data.js?v=20261015-personal6';
const SCOPE='https://www.googleapis.com/auth/gmail.readonly';
const $=id=>document.getElementById(id);
const stamp=timestamp=>timestamp?new Date(timestamp).toLocaleString([],{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}):'';
export function googleReadError(status,body,url){
 const error=body?.error||{};
 const reasons=[...(Array.isArray(error.errors)?error.errors.map(x=>x?.reason):[]),...(Array.isArray(error.details)?error.details.map(x=>x?.reason):[])].filter(x=>typeof x==='string');
 const has=(...codes)=>codes.some(code=>reasons.includes(code));
 const endpoint=url.includes('openidconnect.googleapis.com')?'Google identity':'Gmail';
 if(status===401)return 'Your Google session expired. Disconnect and connect again.';
 if(status===429||has('rateLimitExceeded','userRateLimitExceeded','RATE_LIMIT_EXCEEDED','RESOURCE_EXHAUSTED'))return 'Google is limiting requests. Wait a moment, then refresh. Reconnecting will not fix a rate limit.';
 if(has('dailyLimitExceeded','DAILY_LIMIT_EXCEEDED'))return 'The Google Cloud project has reached its daily API quota. Check its Gmail API quotas before retrying.';
 if(has('accessNotConfigured','SERVICE_DISABLED')||(status===403&&/has not been used|is disabled/i.test(error.message||''))){
  const detail=Array.isArray(error.details)?error.details.find(x=>/^projects\/\d+$/.test(x?.metadata?.consumer||'')):null;
  const project=detail?.metadata.consumer.split('/')[1];
  return 'Gmail API is disabled'+(project?' in Google Cloud project '+project:' in the OAuth client’s Google Cloud project')+'. Enable Gmail API there, wait a few minutes, then connect again.';
 }
 if(has('insufficientPermissions','ACCESS_TOKEN_SCOPE_INSUFFICIENT'))return 'Google did not authorize the required read-only Gmail scope. Disconnect, reconnect, and grant Gmail read access for abdickers@gmail.com.';
 if(has('domainPolicy','ORG_RESTRICTION_VIOLATION'))return 'Google account policy blocks this app from reading Gmail. Check the account administrator’s app access policy.';
 const reason=reasons.find(x=>/^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(x));
 if(status===403)return endpoint+' rejected the request (403'+(reason?' · '+reason:'')+'). Check the OAuth project’s API access and account permissions. No message content was loaded by this failed request.';
 return endpoint+' could not load (HTTP '+status+'). Please try again.';
}
async function readJSON(url,token,signal){
 const response=await fetch(url,{headers:{Authorization:'Bearer '+token},credentials:'omit',cache:'no-store',signal});
 if(!response.ok){
  let body;try{body=await response.json();}catch{}
  // Use only recognized reason codes and a numeric project ID, never raw provider messages or tokens.
  throw Error(googleReadError(response.status,body,url));
 }
 return response.json();
}
export function initPersonalMail(getClientId,connection=null){
 let token='',expiry=0,clientId='',pending=null,oauthClient=null,loadedClient='',epoch=0,preparing=false;
 let active='primary',mailCursor='',receiptCursor='',mailItems=[],receipts=[];
 let mailBusy=false,receiptBusy=false,mailRequest=0,receiptRequest=0;
 let controller=new AbortController();
 const connected=()=>!!token&&(connection?connection.connected():Date.now()<expiry)&&clientId===getClientId();
 const read=(url,credential,signal)=>connection?connection.read(url,{signal}):readJSON(url,credential,signal);
 function setControls(){
  $('mailConnect').textContent=connected()?'Personal Google connected':'Connect Gmail & Calendar';
  $('mailConnect').disabled=connected()||!!pending||preparing;
  $('mailRefresh').disabled=!connected()||mailBusy;
  $('mailDisconnect').hidden=!token&&!pending;
  $('mailMore').hidden=!mailCursor||!connected();$('mailMore').disabled=mailBusy;
  $('receiptsConnect').textContent='Refresh receipts';
  $('receiptsConnect').disabled=!connected()||!!pending||receiptBusy||preparing;
  $('receiptsMore').hidden=!receiptCursor||!connected();$('receiptsMore').disabled=receiptBusy;
  $('receiptsClear').hidden=!receipts.length;
 }
 async function prepare(){
  if(preparing)return;preparing=true;setControls();
  try{
   if(connection){await connection.ready();oauthClient={backend:true};loadedClient=getClientId();return;}
   await googleIdentity();const id=getClientId();
   if(!id)throw Error('Set a Google Web OAuth client ID in Settings first.');
   if(loadedClient!==id){
    const callbacks={response:()=>{},error:()=>{}};
    const client=google.accounts.oauth2.initTokenClient({client_id:id,scope:'openid email '+SCOPE,login_hint:PERSONAL_EMAIL,include_granted_scopes:false,callback:response=>callbacks.response(response),error_callback:error=>callbacks.error(error)});
    oauthClient={client,callbacks};loadedClient=id;
   }
  }catch(error){$('ravensState').textContent=error.message;$('receiptsState').textContent=error.message;}
  finally{preparing=false;setControls();if(connection?.connected()&&!token&&!mailBusy)void loadMail();}
 }
 function disconnect(endConnection=true){
  epoch++;mailRequest++;receiptRequest++;controller.abort();controller=new AbortController();
  pending?.reject(Error('Gmail connection closed.'));pending=null;token='';expiry=0;clientId='';mailItems=[];receipts=[];mailCursor='';receiptCursor='';mailBusy=false;receiptBusy=false;
  $('ravensList').replaceChildren();$('walmartReceipts').replaceChildren();$('amazonReceipts').replaceChildren();
  $('ravensState').textContent='Connect personal Google in Settings to bring the ravens home.';
  $('receiptsState').textContent='Connect personal Gmail to show real Amazon and Walmart receipts here.';$('mailReadAt').textContent='';
  if(connection&&endConnection!==false)connection.disconnect();
  oauthClient=null;loadedClient='';setControls();prepare();
 }
 function authorize(){
  if(connected())return Promise.resolve();
  if(connection)return (async()=>{
   const grantEpoch=epoch,grantClient=getClientId();await connection.connect();
   const grantToken=connection.sessionId();
   const [identity,profile]=await Promise.all([
    connection.read('https://openidconnect.googleapis.com/v1/userinfo',{signal:controller.signal}),
    connection.read('https://gmail.googleapis.com/gmail/v1/users/me/profile',{signal:controller.signal})
   ]);
   if(grantEpoch!==epoch||grantClient!==getClientId())throw Error('Connection changed. Please connect again.');
   if(!personalIdentity(identity,profile))throw Error('Use '+PERSONAL_EMAIL+'. No inbox or receipt content was loaded from the other account.');
   token=grantToken;expiry=connection.expiresAt();clientId=grantClient;setControls();
  })();
  if(pending)return pending.promise;
  if(!oauthClient||loadedClient!==getClientId())throw Error('Google sign-in is preparing. Check your OAuth client in Settings and try again.');
  const grantEpoch=++epoch,grantClient=getClientId();
  let resolveGrant,rejectGrant;const promise=new Promise((resolve,reject)=>{resolveGrant=resolve;rejectGrant=reject;});
  const clear=()=>{if(pending?.epoch===grantEpoch){pending=null;setControls();}};
  pending={promise,reject:rejectGrant,epoch:grantEpoch};
  oauthClient.callbacks.response=async response=>{
   try{
    if(response.error||!response.access_token||!google.accounts.oauth2.hasGrantedAllScopes(response,SCOPE))throw Error('Read-only Gmail permission was not granted. Connect again when ready.');
    const grantToken=response.access_token;
    const [identity,profile]=await Promise.all([
     readJSON('https://openidconnect.googleapis.com/v1/userinfo',grantToken,controller.signal),
     readJSON('https://gmail.googleapis.com/gmail/v1/users/me/profile',grantToken,controller.signal)
    ]);
    if(grantEpoch!==epoch||grantClient!==getClientId())throw Error('Connection changed. Please connect again.');
    if(!personalIdentity(identity,profile))throw Error('Use '+PERSONAL_EMAIL+'. No inbox or receipt content was loaded from the other account.');
    token=grantToken;expiry=Date.now()+Math.max(0,Number(response.expires_in||3600)-60)*1000;clientId=grantClient;clear();resolveGrant();
   }catch(error){clear();rejectGrant(error);}
  };
  oauthClient.callbacks.error=error=>{clear();rejectGrant(Error(error.type==='popup_closed'?'Sign-in closed. Connect again when ready.':'Google sign-in could not open. Allow pop-ups and try in a normal browser tab.'));};
  setControls();
  // Prepared ahead of time so opening the popup stays directly inside the user click.
  try{oauthClient.client.requestAccessToken({prompt:'select_account',login_hint:PERSONAL_EMAIL});}catch(error){clear();rejectGrant(error);}
  return promise;
 }
 async function list(query,cursor,format){
  if(!connected())throw Error('Connect '+PERSONAL_EMAIL+' to load this feed.');
  const activeToken=token,activeEpoch=epoch,signal=controller.signal;
  const params=new URLSearchParams({q:query,maxResults:format==='full'?'30':'20'});if(cursor)params.set('pageToken',cursor);
  const page=await read('https://gmail.googleapis.com/gmail/v1/users/me/messages?'+params,activeToken,signal);
  if((page.messages!==undefined&&!Array.isArray(page.messages))||(page.messages===undefined&&page.resultSizeEstimate!==0))throw Error('Google returned an unfamiliar message list. Refresh to try again.');
  const messages=page.messages||[],results=new Array(messages.length);let next=0;
  await Promise.all(Array.from({length:Math.min(4,messages.length)},async()=>{
   while(next<messages.length){const i=next++,id=messages[i].id;if(!/^[a-f0-9]{1,64}$/i.test(id))throw Error('Google returned an invalid message reference.');
    const options=new URLSearchParams({format});if(format==='metadata')for(const name of ['From','Subject','Date'])options.append('metadataHeaders',name);
    results[i]=await read('https://gmail.googleapis.com/gmail/v1/users/me/messages/'+id+'?'+options,activeToken,signal);
   }
  }));
  if(activeEpoch!==epoch||activeToken!==token||clientId!==getClientId())throw Error('Connection changed. Refresh the feed.');
  return {messages:results,cursor:page.nextPageToken||''};
 }
 function renderMail(resetScroll=false){
  const rows=uniqueConversations(mailItems);
  $('ravensList').innerHTML=rows.map(row=>`<a class="daily-entry" href="${esc(row.href)}" target="_blank" rel="noopener noreferrer"><span class="raven-seal" aria-hidden="true">✉</span><span><small>${esc(row.sender)}</small><strong>${esc(row.subject)}</strong><span>${esc(row.snippet)}</span><time>${esc(stamp(row.timestamp))}</time></span><span aria-hidden="true">↗</span></a>`).join('');
  if(resetScroll)$('ravensList').scrollTop=0;
  $('ravensState').textContent=rows.length?`${rows.length} unread conversations shown${mailCursor?' · more available':''}.`:'No unread conversations in this inbox.';
 }
 async function loadMail(more=false){
  if(mailBusy)return;mailBusy=true;const request=++mailRequest,category=active;
  $('ravensState').textContent='The ravens are returning…';setControls();
  try{
   await authorize();const result=await list(INBOX_QUERIES[category],more?mailCursor:'','metadata');
   if(request!==mailRequest||category!==active)return;
   mailItems=more?[...mailItems,...result.messages]:result.messages;mailCursor=result.cursor;renderMail(!more);$('mailReadAt').textContent='Read '+new Date().toLocaleTimeString([],{hour:'numeric',minute:'2-digit'});
  }catch(error){if(request!==mailRequest)return;$('ravensState').textContent=error.name==='AbortError'?'Read cancelled.':error.message;}
  finally{if(request===mailRequest)mailBusy=false;setControls();}
 }
 function renderReceipts(){
  const clean=[...new Map(receipts.map(row=>[row.id,row])).values()].sort((a,b)=>b.timestamp-a.timestamp);
  for(const name of ['walmart','amazon']){
   const rows=clean.filter(r=>r.retailer===name);
   $(name+'Receipts').innerHTML=rows.length?rows.map(row=>`<a class="receipt-entry" href="${esc(row.href)}" target="_blank" rel="noopener noreferrer"><span class="receipt-event">${esc(row.event)} · ${esc(stamp(row.timestamp))}</span><strong>${esc(row.subject)}</strong><span>${row.orderId?'Order '+esc(row.orderId):'Order number not found'}${row.total?' · '+esc(row.total):''}</span><small>Open source email ↗</small></a>`).join(''):'<p class="realm-account">No matching receipt emails in the loaded results.</p>';
  }
  $('receiptsState').textContent=`${clean.length} receipt emails shown · last 180 days${receiptCursor?' · more available':''}. Multiple emails can refer to the same order. No spending total is inferred.`;
 }
 async function loadReceipts(more=false){
  if(receiptBusy)return;receiptBusy=true;const request=++receiptRequest;
  $('receiptsState').textContent='Checking the supply ledgers…';setControls();
  try{
   await authorize();const result=await list(RECEIPT_QUERY,more?receiptCursor:'','full');
   if(request!==receiptRequest)return;const parsed=result.messages.map(receiptRecord).filter(Boolean);
   receipts=more?[...receipts,...parsed]:parsed;receiptCursor=result.cursor;renderReceipts();
  }catch(error){if(request!==receiptRequest)return;$('receiptsState').textContent=error.name==='AbortError'?'Read cancelled.':error.message;}
  finally{if(request===receiptRequest)receiptBusy=false;setControls();}
 }
 $('mailConnect').addEventListener('click',()=>{if(!oauthClient||loadedClient!==getClientId()){prepare();return;}if(connected())disconnect();else loadMail();});
 $('mailRefresh').addEventListener('click',()=>loadMail());$('mailMore').addEventListener('click',()=>loadMail(true));$('mailDisconnect').addEventListener('click',disconnect);
 $('receiptsConnect').addEventListener('click',()=>{if(connected())loadReceipts();});$('receiptsMore').addEventListener('click',()=>loadReceipts(true));
 $('receiptsClear').addEventListener('click',()=>{receiptRequest++;receiptBusy=false;receipts=[];receiptCursor='';$('walmartReceipts').replaceChildren();$('amazonReceipts').replaceChildren();$('receiptsState').textContent='Receipt view cleared. Your source emails are unchanged.';setControls();});
 for(const button of document.querySelectorAll('[data-inbox]'))button.addEventListener('click',()=>{
  const category=button.dataset.inbox;if(category===active)return;active=category;mailRequest++;mailBusy=false;mailItems=[];mailCursor='';$('ravensList').replaceChildren();
  for(const tab of document.querySelectorAll('[data-inbox]'))tab.setAttribute('aria-pressed',String(tab===button));
  $('ravensCaption').textContent=`Latest unread ${category==='primary'?'Primary':'Updates'} conversations · ${PERSONAL_EMAIL}`;
  $('ravensState').textContent='Connect personal Google in Settings to load this inbox.';setControls();if(connected())loadMail();
 });
 if(connection)connection.subscribe(isConnected=>{if(isConnected){if(!mailBusy)void loadMail();}else disconnect(false);});
 setControls();prepare();return {disconnect};
}

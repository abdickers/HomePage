import { accountLink, PERSONAL_EMAIL } from './account-links.mjs?v=20261015-personal6';
export const INBOX_QUERIES={primary:'in:inbox category:primary is:unread',updates:'in:inbox category:updates is:unread'};
export const RECEIPT_QUERY='newer_than:180d -in:spam -in:trash {from:amazon.com from:walmart.com} {subject:order subject:shipped subject:delivered subject:refund subject:receipt subject:"on the way" subject:pickup}';
export function personalIdentity(identity,profile){return identity?.email_verified===true&&String(identity.email).toLowerCase()===PERSONAL_EMAIL&&String(profile?.emailAddress).toLowerCase()===PERSONAL_EMAIL;}
const header=(message,name)=>(message.payload?.headers||[]).find(h=>h.name.toLowerCase()===name)?.value||'';
export function mailRecord(message){
 if(!/^[a-f0-9]{1,64}$/i.test(message?.id||'')||!/^[a-f0-9]{1,64}$/i.test(message?.threadId||''))return null;
 const timestamp=Number(message.internalDate);
 return {id:message.id,threadId:message.threadId,subject:header(message,'subject').slice(0,400)||'(No subject)',sender:header(message,'from').slice(0,300),snippet:String(message.snippet||'').slice(0,500),timestamp:Number.isFinite(timestamp)?timestamp:0,href:accountLink('https://mail.google.com/mail/#all/'+message.threadId,PERSONAL_EMAIL)};
}
function decodeBody(data){
 try{const value=String(data||'');if(value.length>400000)return '';return new TextDecoder().decode(Uint8Array.from(atob(value.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0)));}catch{return '';}
}
function plainBody(payload,depth=0){
 if(!payload||depth>8)return '';
 if(payload.mimeType==='text/plain')return decodeBody(payload.body?.data).slice(0,100000);
 return (payload.parts||[]).slice(0,20).map(p=>plainBody(p,depth+1)).join('\n').slice(0,100000);
}
export function receiptRecord(message){
 const record=mailRecord(message);if(!record)return null;
 const email=(record.sender.match(/<([^<>\s]+@[^<>\s]+)>/)?.[1]||record.sender.trim()).toLowerCase();
 const domain=email.split('@')[1];
 const retailer=['amazon','walmart'].find(name=>domain===name+'.com'||domain?.endsWith('.'+name+'.com'));
 if(!retailer||!/order|shipp|deliver|refund|receipt|on the way|pickup/i.test(record.subject))return null;
 const body=plainBody(message.payload);const text=record.subject+'\n'+body+'\n'+record.snippet;
 const orderId=retailer==='amazon'?text.match(/\b\d{3}-\d{7}-\d{7}\b/)?.[0]:text.match(/\border\s*(?:number|no\.?|#|id|:)\s*[:#]?\s*([\d-]{8,30})\b/i)?.[1];
 const amounts=[...body.matchAll(/(?:grand total|order total|total paid|total charged)\s*:?\s*(?:USD\s*)?\$\s*(\d[\d,]*\.\d{2})\b/gi)].map(m=>m[1].replace(/,/g,''));
 const unique=[...new Set(amounts)];
 // Show an amount only when an explicit order-total label is unambiguous.
 const total=unique.length===1?'$'+Number(unique[0]).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2}):null;
 const subject=record.subject.toLowerCase();
 const event=/cancel/.test(subject)?'Cancellation email':/refund/.test(subject)?'Refund email':/delivered/.test(subject)?'Delivery email':/shipp|on the way/.test(subject)?'Shipping email':/pickup|ready/.test(subject)?'Pickup email':'Order email';
 return {...record,retailer,orderId:orderId||null,total,event};
}
export function uniqueConversations(messages){
 const seen=new Set();return messages.map(mailRecord).filter(Boolean).sort((a,b)=>b.timestamp-a.timestamp).filter(m=>{if(seen.has(m.threadId))return false;seen.add(m.threadId);return true;});
}

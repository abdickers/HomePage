import {merchantFor,money,validDate,today} from './domain.mjs';
const decode=value=>{try{return new TextDecoder().decode(Uint8Array.from(atob(value.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0)));}catch{return '';}};
function plainHtml(value){return value.replace(/<(script|style)[\s\S]*?<\/\1>/gi,' ').replace(/<[^>]*>/g,' ').replace(/&nbsp;|&#160;/g,' ').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/\s+/g,' ');}
function messageText(payload){
  const text=[],html=[];
  const walk=(part,depth=0)=>{if(depth>8)return;if(part.body?.data&&!part.filename){const value=decode(part.body.data).slice(0,65536);if(part.mimeType==='text/plain')text.push(value);else if(part.mimeType==='text/html')html.push(plainHtml(value));}for(const child of part.parts||[])walk(child,depth+1);};
  walk(payload);return (text.length?text:html).join('\n').slice(0,65536);
}
const MONTHS={january:1,february:2,march:3,april:4,may:5,june:6,july:7,august:8,september:9,october:10,november:11,december:12};
function explicitDate(text){
  const label=/(?:due(?:\s+(?:date|on|by))?|renew(?:s|al)?(?:\s+(?:date|on))?|next (?:payment|billing)(?: date)?)[\s:,-]{0,12}(\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/\d{4}|(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}(?:st|nd|rd|th)?,?\s+\d{4})/gi;
  const found=[];
  for(const match of text.matchAll(label)){
    let value=match[1];if(value.includes('/')){const [m,d,y]=value.split('/');value=`${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`;}
    else if(!value.includes('-')){const parts=value.toLowerCase().replace(/(\d)(?:st|nd|rd|th)/g,'$1').replace(',','').split(/\s+/);value=`${parts[2]}-${String(MONTHS[parts[0]]).padStart(2,'0')}-${parts[1].padStart(2,'0')}`;}
    if(validDate(value))found.push({value,evidence:match[0].slice(0,160)});
  }
  return found;
}
export function parseBudgetMessage(message,email,sourceId) {
  if(!/^[a-f0-9]{1,128}$/.test(message.id||''))return null;
  const headers=message.payload?.headers||[],header=name=>String(headers.find(h=>h.name.toLowerCase()===name)?.value||'').slice(0,1000);
  const subject=header('subject'),from=header('from'),body=messageText(message.payload||{}),text=subject+'\n'+body;
  const merchant=merchantFor(subject+' '+from+' '+body.slice(0,12000));
  if(!merchant&&!/subscription|invoice|renewal|amount due|payment confirmation/i.test(subject))return null;
  const amounts=[];let invalidAmount=false;
  for(const match of text.matchAll(/(?:order total|total paid|amount paid|amount due|balance due|payment amount|new price|renewal price|total|charged|payment of|paid|refund(?: amount)?)[\s:,-]{0,12}(?:USD\s*|US)?\$\s*([0-9]+(?:,[0-9]{3})*(?:\.[0-9]{2})?)/gi)){
    try{amounts.push({value:money(match[1].replaceAll(',','')),evidence:match[0].slice(0,160)});}catch{invalidAmount=true;}
  }
  const values=[...new Set(amounts.map(a=>a.value))],dates=explicitDate(text),dateValues=[...new Set(dates.map(d=>d.value))];
  const frequency=/\b(annually|annual (?:plan|subscription|membership)|per year|yearly|every 12 months)\b/i.test(text)?'annual':/\b(monthly|per month|every month)\b/i.test(text)?'monthly':/\b(quarterly|every 3 months)\b/i.test(text)?'quarterly':null;
  const cancel=/(?:subscription|membership|auto.?renew(?:al)?).{0,80}(?:cancelled|canceled|turned off|will not renew)|(?:cancelled|canceled).{0,40}(?:subscription|membership)/i.test(text);
  const refund=/refund (?:issued|processed|confirmation|of|amount)|you(?:'ve| have) been refunded/i.test(text);
  const payment=/payment (?:received|confirmed|successful|completed)|successfully (?:paid|charged)|receipt|thank you for your (?:payment|order)|total paid|amount paid/i.test(text)&&!/payment (?:failed|declined|unsuccessful)/i.test(subject);
  const invoice=/amount due|balance due|invoice|payment due/i.test(text);
  const priceChange=/price (?:change|increase|will)|new price|rate (?:change|increase)/i.test(text);
  const conflicts=[];if(invalidAmount)conflicts.push('A labeled amount is outside the supported range; confirm it manually');if(values.length>1)conflicts.push('Several labeled totals; amount needs review');if(dateValues.length>1)conflicts.push('Several due or renewal dates; date needs review');if(priceChange)conflicts.push('Price change notice; confirm the effective price and date');
  const order=text.match(/(?:order|invoice)(?:\s+(?:number|no\.?|id))?[\s:#-]{1,12}([A-Z0-9][A-Z0-9-]{4,60})/i)?.[1]||null;
  const received=new Date(Number(message.internalDate));if(Number.isNaN(received.getTime()))return null;
  const serviceName=merchant?.id==='google-home'?text.match(/Google Home (?:Pro|Premium)|Google Nest Aware|Nest Aware(?: Plus)?/i)?.[0]:null;
  return {id:sourceId+':'+message.id,sourceId,messageId:message.id,email,sourceUrl:`https://mail.google.com/mail/?authuser=${encodeURIComponent(email)}#all/${message.id}`,merchantId:merchant?.id||'unidentified',merchant:serviceName||merchant?.name||'Unidentified bill',serviceName:serviceName||null,date:today(received),dueDate:dateValues.length===1?dateValues[0]:null,amountCents:values.length===1?(refund?-values[0]:values[0]):null,amountChoices:values,currency:/\b(?:CAD|AUD|EUR|GBP)\b|[€£]/.test(text)?'UNCONFIRMED':'USD',frequency,kind:cancel?'cancellation':refund?'refund':invoice?'bill':payment?'receipt':'notice',paymentStatus:payment?'paid':invoice?'unpaid':'unknown',orderId:order,category:merchant?.category||'Uncategorized',subscription:!!merchant?.subscription,certainty:{amount:values.length===1?'confirmed':'unconfirmed',dueDate:dateValues.length===1?'confirmed':'unconfirmed',frequency:frequency?'confirmed':'unconfirmed'},evidence:{amount:amounts.map(a=>a.evidence).slice(0,4),dueDate:dates.map(d=>d.evidence).slice(0,3)},conflicts,receivedAt:received.toISOString()};
}
export function discoveryQuery(afterSeconds,beforeSeconds){return `after:${Math.floor(afterSeconds)} before:${Math.floor(beforeSeconds)} {bill invoice receipt renewal subscription membership "payment confirmation" "payment received" "amount due" "price change" "child support" mortgage bankruptcy "TFS"}`;}

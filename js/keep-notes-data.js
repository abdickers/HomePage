import {accountLink, PERSONAL_EMAIL} from './account-links.mjs?v=20261015-personal7';

export const KEEP_HOME=accountLink('https://keep.google.com/',PERSONAL_EMAIL);
export function keepNoteUrl(value) {
  if(typeof value!=='string'||value.length>2048)return null;
  try {
    const url=new URL(value.trim());
    if(url.protocol!=='https:'||url.hostname!=='keep.google.com'||url.port||url.username||url.password||!/^#NOTE\/.+/.test(url.hash))return null;
    return accountLink(url.href,PERSONAL_EMAIL);
  } catch {return null;}
}
export function normalizeKeepLinks(value) {
  const items=Array.isArray(value)?value:[],byId=new Map();
  const time=value=>typeof value==='string'&&Number.isFinite(Date.parse(value))?new Date(value).toISOString():'';
  for(const [index,item] of items.entries()) {
    if(!item||typeof item.title!=='string'||!item.title.trim())continue;
    const url=keepNoteUrl(item.url);if(!url)continue;
    const id=String(item.id||'keep-link-'+index).slice(0,100);
    byId.set(id,{id,title:item.title.trim().slice(0,100),url,savedAt:time(item.savedAt),openedAt:time(item.openedAt)});
    if(byId.size>=100)break;
  }
  return [...byId.values()];
}
export function recentKeepLinks(links) {
  const recent=link=>Math.max(Date.parse(link.savedAt)||0,Date.parse(link.openedAt)||0);
  return [...links].sort((a,b)=>recent(b)-recent(a));
}

export const GMAIL_SCOPE = 'https://www.googleapis.com/auth/gmail.readonly';
export const CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar.events.readonly';
export const GOOGLE_SCOPES = 'openid email ' + GMAIL_SCOPE + ' ' + CALENDAR_SCOPE;

// Rebuild only the read endpoints used by this dashboard. Never forward an
// arbitrary host, user, path, method, or query to Google with an owner's token.
export function googleReadTarget(value) {
 let u;try{u=new URL(value);}catch{return null;}
 if(u.protocol!=='https:'||u.username||u.password||u.port||u.hash||u.href.length>8192)return null;
 let allowed;
 if(u.hostname==='openidconnect.googleapis.com'&&u.pathname==='/v1/userinfo')allowed=[];
 else if(u.hostname==='gmail.googleapis.com'&&u.pathname==='/gmail/v1/users/me/profile')allowed=[];
 else if(u.hostname==='gmail.googleapis.com'&&u.pathname==='/gmail/v1/users/me/messages')allowed=['q','maxResults','pageToken'];
 else if(u.hostname==='gmail.googleapis.com'&&/^\/gmail\/v1\/users\/me\/messages\/[a-f0-9]{1,64}$/i.test(u.pathname))allowed=['format','metadataHeaders'];
 else if(u.hostname==='www.googleapis.com'&&/^\/calendar\/v3\/calendars\/[^/]{1,600}\/events$/.test(u.pathname))allowed=['singleEvents','orderBy','timeMin','timeMax','maxResults','pageToken'];
 else return null;
 if([...u.searchParams.keys()].some(key=>!allowed.includes(key)))return null;
 for(const key of allowed){if(key!=='metadataHeaders'&&u.searchParams.getAll(key).length>1)return null;}
 if(u.searchParams.has('format')&&!['metadata','full'].includes(u.searchParams.get('format')))return null;
 if(u.searchParams.has('maxResults')){
  const max=Number(u.searchParams.get('maxResults'));if(!Number.isInteger(max)||max<1||max>50)return null;
 }
 if(u.searchParams.has('metadataHeaders')&&(u.searchParams.getAll('metadataHeaders').length>10||u.searchParams.getAll('metadataHeaders').some(x=>!['From','Subject','Date'].includes(x))))return null;
 return u.href;
}

import { accountLink, PERSONAL_EMAIL, WORK_URL } from './account-links.mjs?v=20261015-personal6';
import {normalizeQuickLinks, internalLink, LINK_ICONS} from './quick-links.js?v=20261028-apps1';
import {normalizeKeepLinks} from './keep-notes-data.js?v=20261018-bagend4';
export const DATA_KEY = 'sage_command_v9';
export const DEFAULT_SETTINGS = {
  name: 'Sage', unit: 'fahrenheit', weatherSource:'station',
  location: {name: 'Columbia, MO', lat: 38.9517, lon: -92.3341},
  clientId: '644801431816-9f7u70h62fipmebva3llupi2o17b1g80.apps.googleusercontent.com',
  calendarId: 'primary'
};

const LEGACY_LINKS = [
  ['ChatGPT','https://chatgpt.com/','ai'], ['Claude','https://claude.ai/','ai'],
  ['Gemini','https://gemini.google.com/app','ai'], ['Grok','https://grok.com/','ai'],
  ['Perplexity','https://www.perplexity.ai/','ai'], ['Copilot','https://copilot.microsoft.com/','ai'],
  ['Midjourney','https://www.midjourney.com/','ai'], ['Runway','https://runwayml.com/','ai'],
  ['NetSuite','https://system.netsuite.com/','tools'], ['Slack','https://slack.com/signin','tools'],
  ['BigCommerce','https://login.bigcommerce.com/','tools'], ['Vercel','https://vercel.com/dashboard','tools'],
  ['Jira','https://start.atlassian.com/','tools'], ['Confluence','https://start.atlassian.com/','tools'],
  ['Dotdigital','https://login.dotdigital.com/','tools'], ['Zoom','https://zoom.us/signin','tools'],
  ['GitHub','https://github.com/abdickers/HomePage','tools'], ['Google Admin','https://admin.google.com/','tools'],
  ['Cloudflare','https://dash.cloudflare.com/','tools'], ['Canva','https://www.canva.com/','tools'],
  ['Notion','https://www.notion.so/','tools'], ['Obsidian','https://obsidian.md/','tools'],
  ['My Drive','https://drive.google.com/drive/my-drive','quick'], ['Gmail','https://mail.google.com/','quick'],
  ['Google Calendar','https://calendar.google.com/calendar/u/0/r','quick'], ['Google Docs','https://docs.google.com/document/u/0/','quick'],
  ['Google Sheets','https://docs.google.com/spreadsheets/u/0/','quick'], ['Google Slides','https://docs.google.com/presentation/u/0/','quick'],
  ['Google Keep','https://keep.google.com/','quick'], ['Google Photos','https://photos.google.com/','quick'],
  ['Google Meet','https://meet.google.com/','quick'], ['Recent Files','https://drive.google.com/drive/recent','quick']
].map(([name,url,group], i) => ({id:'link-'+i, name,url,group}));
// Legacy work shortcuts belong in the White Tower. Custom service URLs are retained.
const WORK_NAMES = new Set(['NetSuite','Slack','BigCommerce','Vercel','Jira','Confluence','Dotdigital','Zoom','Google Admin','Cloudflare']);
const WORK_DEFAULTS = new Map(LEGACY_LINKS.filter(l=>WORK_NAMES.has(l.name)).map(l=>[l.name,l.url]));
const WORK_PORTAL = {id:'work-command-center',name:'Work Command Center',url:WORK_URL,group:'tools'};
const REMOVED_NAMES = new Set(['claude','grok','perplexity','copilot','midjourney','runway','canva','notion','obsidian','spark','spark driver','customer spark']);
const removedHosts = ['claude.ai','grok.com','perplexity.ai','copilot.microsoft.com','midjourney.com','runwayml.com','canva.com','notion.so','obsidian.md','sparkdriverapp.com','customersparkcommunity.walmart.com'];
function wantedLink(link) {
 if(!link || typeof link.name!=='string')return true;
 if(REMOVED_NAMES.has(link.name.toLowerCase().trim()))return false;
 if(link.group==='ai'&&!['chatgpt','gemini'].includes(link.name.toLowerCase().trim()))return false;
 try { const host=new URL(link.url).hostname.replace(/^www\./,'');return !removedHosts.some(h=>host===h||host.endsWith('.'+h)); } catch {return true;}
}
export const DEFAULT_LINKS = [...LEGACY_LINKS.filter(l=>!WORK_NAMES.has(l.name)&&wantedLink(l)),WORK_PORTAL,
 {id:'battle-net',name:'Battle.net',url:'https://account.battle.net/',group:'tools'},
 {id:'wow-armory',name:'Frear · Armory',url:'https://worldofwarcraft.blizzard.com/en-us/character/us/grizzly-hills/frear/',group:'tools'}];
function migrateLinks(links) {
 if(!Array.isArray(links))return DEFAULT_LINKS;
 const removedWork=links.some(l=>l&&WORK_DEFAULTS.get(l.name)===l.url);
 links=links.map(l=>l?.url==='https://github.com/InkedSage/Homepage'?{...l,url:'https://github.com/abdickers/HomePage'}:l);
 const kept=links.filter(l=>(!l||WORK_DEFAULTS.get(l.name)!==l.url)&&wantedLink(l));
 return removedWork&&!kept.some(l=>l?.id===WORK_PORTAL.id)?[...kept,WORK_PORTAL]:kept;
}


export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

export function safeUrl(value) {
  try { const u = new URL(value); return ['http:','https:'].includes(u.protocol) && !u.username && !u.password ? u.href : null; }
  catch { return null; }
}

export const safeLinkUrl = value => internalLink(value) || safeUrl(value);

export function localDate(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
}

export function validDate(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && localDate(new Date(value + 'T12:00:00')) === value;
}

export function normalizeSettings(value = {}, links = DEFAULT_LINKS) {
  if (!value || typeof value !== 'object') value = {};
  const s = {...DEFAULT_SETTINGS};
  if (typeof value.name === 'string' && value.name.trim()) s.name = value.name.trim().slice(0,40);
  if (['fahrenheit','celsius'].includes(value.unit)) s.unit = value.unit;
  if(['station','regional'].includes(value.weatherSource))s.weatherSource=value.weatherSource;
  for (const key of ['clientId','calendarId']) if (typeof value[key] === 'string') s[key] = value[key].trim().slice(0,300);
  if (!s.calendarId) s.calendarId = 'primary';
  const l = value.location;
  if (l && typeof l.name === 'string' && l.name.trim() && Number.isFinite(l.lat) && Math.abs(l.lat)<=90 && Number.isFinite(l.lon) && Math.abs(l.lon)<=180) {
    s.location = {name:l.name.slice(0,100),lat:l.lat,lon:l.lon};
  }
  s.quickLinks = normalizeQuickLinks(value.quickLinks, links);
  return s;
}

export function normalizeData(raw = {}) {
  if (!raw || typeof raw !== 'object') raw = {};
  const unique = (items) => [...new Map(items.map(item => [item.id,item])).values()];
  const tasks = (Array.isArray(raw.tasks) ? raw.tasks : []).filter(t => t && typeof t.text === 'string' && t.text.trim()).slice(0,5000).map((t,i) => ({
    id: String(t.id || 'migrated-task-'+i).slice(0,100), text:t.text.trim().slice(0,300),
    done:t.done === true, star:t.star === true, due:validDate(t.due) ? t.due : '', created:typeof t.created === 'string' ? t.created.slice(0,40) : ''
  }));
  const notes = (Array.isArray(raw.notes) ? raw.notes : []).filter(n => n && (Array.isArray(n) || typeof n === 'object')).map((n,i) => ({
    id:String(n.id || 'migrated-note-'+i).slice(0,100),
    title:String(Array.isArray(n) ? n[0] || 'Note' : n.title || 'Note').slice(0,100),
    text:String(Array.isArray(n) ? n[1] || '' : n.text ?? (Array.isArray(n.lines) ? n.lines.join('\n') : '')).slice(0,10000)
  })).slice(0,1000);
  const links = migrateLinks(raw.links).filter(l => l && typeof l.name === 'string' && l.name.trim() && safeLinkUrl(l.url)).slice(0,500).map((l,i) => ({
    id:String(l.id || 'import-link-'+i).slice(0,100),name:l.name.trim().slice(0,60),url:internalLink(l.url)||accountLink(l.url,PERSONAL_EMAIL,l.name),group:['ai','tools','quick'].includes(l.group) ? l.group : 'tools',icon:Object.hasOwn(LINK_ICONS,l.icon) ? l.icon : 'auto'
  }));
  return {version:9,tasks:unique(tasks),notes:unique(notes),links:unique(links),keepLinks:normalizeKeepLinks(raw.keepLinks),settings:normalizeSettings(raw.settings,unique(links))};
}

export function readData(storage) {
  const parse = key => { try { return JSON.parse(storage.getItem(key)); } catch { return null; } };
  const saved = parse(DATA_KEY);
  if (saved && typeof saved === 'object') return normalizeData(saved);
  return normalizeData({tasks:parse('sage_tasks_v8') ?? parse('sage_tasks_v2'), notes:parse('sage_notes_v2')});
}

export function mergeBackup(current, incoming) {
  if (!incoming || typeof incoming !== 'object' || incoming.version !== 9 || !['tasks','notes','links'].every(k=>Array.isArray(incoming[k]))) throw new Error('Choose a Sage Command backup exported by this dashboard.');
  const clean = normalizeData(incoming);
  return normalizeData({...clean,tasks:[...current.tasks,...clean.tasks],notes:[...current.notes,...clean.notes],keepLinks:[...(current.keepLinks||[]),...clean.keepLinks]});
}

export function taskGroup(task, today = localDate()) { return task.due && task.due > today ? 'upcoming' : 'today'; }

export function normalizeObservation(obs, unit) {
  const value = field => typeof obs[field]?.value === 'number' && Number.isFinite(obs[field].value) ? obs[field].value : null;
  let temp = value('temperature');
  if (temp !== null && /degF$/.test(obs.temperature.unitCode || '')) temp = (temp-32)*5/9;
  let wind = value('windSpeed');
  const code = obs.windSpeed?.unitCode || '';
  if (wind !== null) {
    if (/km_h-1$/.test(code)) wind /= 3.6;
    else if (/mi_h-1$/.test(code)) wind /= 2.236936;
    else if (/kn$/.test(code)) wind *= 0.514444;
    else if (!/m_s-1$/.test(code)) wind = null;
  }
  let rain = value('precipitationLastHour');
  const rainCode = obs.precipitationLastHour?.unitCode || '';
  if (rain !== null) {
    if (/:m$/.test(rainCode)) rain *= 1000;
    else if (/:in$/.test(rainCode)) rain *= 25.4;
    else if (!/:mm$/.test(rainCode)) rain = null;
  }
  return {temp:temp === null ? null : unit==='celsius' ? temp : temp*9/5+32, humidity:value('relativeHumidity'),wind:wind === null ? null : unit==='celsius' ? wind*3.6 : wind*2.236936,rain:rain === null ? null : unit==='celsius' ? rain : rain/25.4,description:obs.textDescription || 'Current conditions',time:obs.timestamp};
}

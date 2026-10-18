// Shared by saved data, the header and the Settings draft. No network icons.
export const LINK_ICONS = {
  auto: ['Automatic', ''], neutral: ['Link', 'assets/service-icons/link.svg'],
  chatgpt: ['ChatGPT', 'assets/logos/chatgpt.svg'], gemini: ['Gemini', 'assets/logos/gemini.svg'],
  github: ['GitHub', 'assets/logos/github.svg'], gmail: ['Gmail', 'assets/logos/gmail.png'],
  calendar: ['Calendar', 'assets/logos/calendar.png'], drive: ['Drive', 'assets/logos/drive.png'],
  docs: ['Docs', 'assets/service-icons/docs.svg'], sheets: ['Sheets', 'assets/service-icons/sheets.svg'],
  slides: ['Slides', 'assets/service-icons/slides.svg'], keep: ['Keep', 'assets/service-icons/keep.svg'],
  photos: ['Photos', 'assets/service-icons/photos.svg'], meet: ['Meet', 'assets/service-icons/meet.svg'],
  home: ['Bag End', 'assets/redesign/icon-bag-end.webp'], treasury: ['Treasury', 'assets/personal-theme/dwarven-vault.webp'],
  work: ['Work', 'assets/redesign/icon-wisdom.webp']
};
for (const [name,file] of Object.entries({NetSuite:'netsuite.svg',Slack:'slack.svg',BigCommerce:'bigcommerce.svg',Vercel:'vercel.svg',Jira:'jira.svg',Confluence:'confluence.svg',Dotdigital:'dotdigital.png',Zoom:'zoom.svg',Cloudflare:'cloudflare.svg'})) LINK_ICONS[name]=[name,'assets/logos/'+file];
export function linkIcon(link) {
  if (link.icon && link.icon !== 'auto' && Object.hasOwn(LINK_ICONS,link.icon)) return LINK_ICONS[link.icon][1];
  const known = {'ChatGPT':'chatgpt','Gemini':'gemini','GitHub':'github','Gmail':'gmail',
    'Google Calendar':'calendar','My Drive':'drive','Recent Files':'drive','Google Docs':'docs',
    'Google Sheets':'sheets','Google Slides':'slides','Google Keep':'keep','Google Photos':'photos',
    'Google Meet':'meet','Work Command Center':'work'};
  return LINK_ICONS[known[link.name] || (Object.hasOwn(LINK_ICONS,link.name)?link.name:'neutral')][1];
}
export function normalizeQuickLinks(value, links) {
  const known = new Map(links.map(link => [link.id, link]));
  const seen = new Set(), items = [];
  for (const entry of Array.isArray(value?.items) ? value.items : []) {
    if (!entry || !known.has(entry.id) || seen.has(entry.id)) continue;
    items.push({id: entry.id, enabled: entry.enabled === true}); seen.add(entry.id);
  }
  for (const link of links) if (!seen.has(link.id)) items.push({id:link.id, enabled:link.group === 'quick'});
  return {version:1, items};
}
export function headerLinks(links, preferences) {
  const byId = new Map(links.map(link => [link.id,link]));
  return normalizeQuickLinks(preferences,links).items.filter(item => item.enabled).map(item => byId.get(item.id));
}
const sections = new Set(['dashboard','homePanel','dailyProvisioning','keepPanel','wowPanel','budgetPanel','toolsPanel','breePanel']);
export function internalLink(value) {
  if (typeof value !== 'string') return null;
  const text = value.trim();
  if (['./','/HomePage/'].includes(text)) return text;
  const match = /^(?:\.\/|\/HomePage\/)?#([A-Za-z][\w-]*)$/.exec(text);
  return match && sections.has(match[1]) ? '#' + match[1] : null;
}

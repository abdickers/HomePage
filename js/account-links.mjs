/** Account hints route Google links; other providers retain their own browser sessions. */
export const PERSONAL_EMAIL = 'abdickers@gmail.com';
export const WORK_EMAIL = 'dickersona@76fireworks.com';
export const PERSONAL_URL = 'https://abdickers.github.io/HomePage/';
export const WORK_URL = 'https://adams-middle-earth-command.spirit-of-76-1921.chatgpt.site/';
const googleHosts = new Set(['mail.google.com','calendar.google.com','drive.google.com','docs.google.com','keep.google.com','photos.google.com','meet.google.com','myaccount.google.com','gemini.google.com']);
const workDefaults = {
 'https://slack.com/':'https://76fireworks.slack.com/',
 'https://dotdigital.com/':'https://login.dotdigital.com/',
 'https://www.avalara.com/':'https://admin.avalara.com/',
 'https://www.cybersource.com/':'https://businesscenter.cybersource.com/'
};
export function accountLink(value, email, name = '') {
 try {
  const u = new URL(value);
  if (!['http:','https:'].includes(u.protocol) || u.username || u.password) return '';
  if (googleHosts.has(u.hostname)) {
   u.pathname = u.pathname.replace(/\/u\/\d+(?=\/|$)/g,'');
   if (u.hostname === 'mail.google.com' && u.pathname === '/') u.pathname = '/mail/';
   if (u.hostname === 'calendar.google.com' && u.pathname === '/') u.pathname = '/calendar/r';
   u.searchParams.set('authuser', email);
  }
  if (email === WORK_EMAIL) {
   if (u.hostname === 'start.atlassian.com' && u.pathname === '/') return name === 'Confluence' ? 'https://76fireworks.atlassian.net/wiki/' : 'https://76fireworks.atlassian.net/';
   return workDefaults[u.href] || u.href;
  }
  return u.href;
 } catch { return ''; }
}

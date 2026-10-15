import test from 'node:test';
import assert from 'node:assert/strict';
import {accountLink,PERSONAL_EMAIL,WORK_EMAIL} from '../js/account-links.mjs';
test('Google links select the realm account and remove conflicting numeric selectors',()=>{
 for(const email of [PERSONAL_EMAIL,WORK_EMAIL]){
  const url=new URL(accountLink('https://calendar.google.com/calendar/u/0/r/eventedit?eid=abc&authuser=wrong%40example.com',email));
  assert.equal(url.searchParams.get('authuser'),email);assert.equal(url.searchParams.get('eid'),'abc');assert.equal(url.pathname,'/calendar/r/eventedit');
  const mail=new URL(accountLink('https://mail.google.com/mail/u/1/#inbox/123',email));
  assert.equal(mail.hash,'#inbox/123');assert.equal(mail.searchParams.get('authuser'),email);
 }
});
test('work generic destinations migrate without overwriting customized tenant URLs',()=>{
 assert.equal(accountLink('https://start.atlassian.com/',WORK_EMAIL,'Confluence'),'https://76fireworks.atlassian.net/wiki/');
 assert.equal(accountLink('https://slack.com/',WORK_EMAIL),'https://76fireworks.slack.com/');
 assert.equal(accountLink('https://custom.slack.com/my-team',WORK_EMAIL),'https://custom.slack.com/my-team');
 assert.equal(accountLink('https://chatgpt.com/',PERSONAL_EMAIL),'https://chatgpt.com/');
 assert.equal(accountLink('https://chatgpt.com/',WORK_EMAIL),'https://chatgpt.com/');
 for(const url of ['javascript:alert(1)','https://user:pass@example.com','//example.com'])assert.equal(accountLink(url,WORK_EMAIL),'');
});

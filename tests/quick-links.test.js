import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeData, normalizeSettings, readData, mergeBackup, DATA_KEY, safeLinkUrl} from '../js/core.js';
import {headerLinks,linkIcon,LINK_ICONS} from '../js/quick-links.js';
import {access} from 'node:fs/promises';

test('old profiles seed header icons from their existing Quick Access list, without new destinations',()=>{
  const data=normalizeData();
  assert.deepEqual(headerLinks(data.links,data.settings.quickLinks).map(l=>l.id),data.links.filter(l=>l.group==='quick').map(l=>l.id));
  assert.deepEqual(normalizeData({links:[]}).settings.quickLinks.items,[]);
});
test('saved visibility and order survive normalization, storage, unrelated preference edits and backup',()=>{
  const data=normalizeData();
  data.settings.quickLinks.items.reverse();
  data.settings.quickLinks.items.forEach((item,i)=>item.enabled=i<2);
  const expected=headerLinks(data.links,data.settings.quickLinks).map(l=>l.id);
  const restored=readData({getItem:key=>key===DATA_KEY?JSON.stringify(data):null});
  restored.settings=normalizeSettings({...restored.settings,name:'Sage Updated'},restored.links);
  assert.deepEqual(headerLinks(restored.links,restored.settings.quickLinks).map(l=>l.id),expected);
  assert.deepEqual(mergeBackup(normalizeData(),restored).settings.quickLinks,restored.settings.quickLinks);
  restored.settings.quickLinks.items.forEach(item=>item.enabled=false);
  assert.deepEqual(headerLinks(normalizeData(restored).links,normalizeData(restored).settings.quickLinks),[]);
});
test('removed or duplicate IDs disappear, new links default by section, corrupt preferences are safe',()=>{
  const data=normalizeData({links:[{id:'a',name:'A',url:'https://example.com',group:'quick'},{id:'b',name:'B',url:'https://example.org',group:'tools'}],settings:{quickLinks:{items:[null,{id:'missing',enabled:true},{id:'a',enabled:false},{id:'a',enabled:true}]}}});
  assert.deepEqual(data.settings.quickLinks.items,[{id:'a',enabled:false},{id:'b',enabled:false}]);
  data.links.push({id:'new',name:'New',url:'https://example.net',group:'quick'});
  assert.deepEqual(headerLinks(normalizeData(data).links,normalizeData(data).settings.quickLinks).map(l=>l.id),['new']);
  assert.doesNotThrow(()=>normalizeData({settings:{quickLinks:{items:'bad'}}}));
});
test('editable destinations accept real dashboard routes and web URLs while rejecting executable and deceptive addresses',()=>{
  for(const url of ['javascript:alert(1)','data:text/html,x','//evil.example','/\\evil.example','#not-a-route','https://user:pass@example.org','https://','/HomePage/../../outside'])assert.equal(safeLinkUrl(url),null);
  assert.equal(safeLinkUrl('#homePanel'),'#homePanel');
  assert.equal(safeLinkUrl('/HomePage/#budgetPanel'),'#budgetPanel');
  const data=normalizeData({links:[{id:'internal',name:'Home',url:'#homePanel',group:'quick',icon:'home'}]});
  assert.equal(data.links[0].url,'#homePanel');assert.equal(data.links[0].icon,'home');
});
test('known icons, chosen icons and unknown-icon fallback use existing bundled files only',async()=>{
  for(const [,file] of Object.values(LINK_ICONS))if(file)await access(new URL('../'+file,import.meta.url));
  const custom={name:'Unrecognized',url:'https://private-user-domain.example/path',icon:'untrusted'};
  assert.equal(linkIcon(custom),'assets/service-icons/link.svg');
  assert.equal(linkIcon({...custom,icon:'gmail'}),'assets/logos/gmail.png');
  assert.equal(normalizeData({links:[{id:'custom',...custom,group:'quick'}]}).links[0].icon,'auto');
});

test('existing and renamed game links resolve to official local icons without changing saved preferences',()=>{
  const games=normalizeData().links.filter(link=>['battle-net','wow-armory'].includes(link.id));
  assert.equal(games.length,2);
  for(const link of games){
    const expected=link.id==='battle-net'?'assets/logos/battlenet.png':'assets/logos/warcraft.png';
    assert.equal(link.icon,'auto');
    assert.equal(linkIcon(link),expected);
    assert.equal(linkIcon({...link,name:'My game account'}),expected);
    assert.equal(linkIcon({...link,icon:'gmail'}),'assets/logos/gmail.png');
  }
  assert.equal(linkIcon({name:'Game',url:'https://account.battle.net.evil.example/'}),'assets/service-icons/link.svg');
});

test('renamed service links use company assets while deceptive domains cannot impersonate them',()=>{
 for(const [url,file] of [['https://play.google.com/console/u/0/developers/123/home','play.png'],['https://www.samsclub.com/orders','samsclub.png'],['https://www.walmart.com/plus','walmart.png'],['https://www.amazon.com/gp/orders','amazon.png'],['https://console.cloud.google.com/','googlecloud.png'],['https://dashboard.plaid.com','plaid.png']]){
  assert.equal(linkIcon({name:'My renamed tool',url}),'assets/logos/'+file);
  assert.equal(linkIcon({name:'My renamed tool',url,icon:'neutral'}),'assets/service-icons/link.svg');
 }
 for(const url of ['https://play.google.com.evil.example/console/','https://samsclub.com.evil.example/','https://play.google.com/books/'])assert.equal(linkIcon({name:'Unknown',url}),'assets/service-icons/link.svg');
});

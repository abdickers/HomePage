import test from 'node:test';
import assert from 'node:assert/strict';
import {keepNoteUrl,normalizeKeepLinks,recentKeepLinks} from '../js/keep-notes-data.js';
import {normalizeData,mergeBackup,readData,DATA_KEY} from '../js/core.js';

test('saved note links accept individual Keep notes and reject other sites, credentials and executable addresses',()=>{
  for(const value of ['javascript:alert(1)','data:text/html,hello','https://keep.google.com.evil.test/#NOTE/abc','https://user:pass@keep.google.com/#NOTE/abc','http://keep.google.com/#NOTE/abc','https://keep.google.com/','https://example.org/#NOTE/abc'])assert.equal(keepNoteUrl(value),null);
  const url=new URL(keepNoteUrl('https://keep.google.com/u/0/#NOTE/example-note'));
  assert.equal(url.hostname,'keep.google.com');assert.equal(url.hash,'#NOTE/example-note');assert.equal(url.searchParams.get('authuser'),'abdickers@gmail.com');assert.equal(url.pathname,'/');
});
test('real saved links survive reload and backup without replacing legacy notes or unrelated data',()=>{
  const current=normalizeData({notes:[{id:'old',title:'Original note',text:'Keep this'}],keepLinks:[{id:'saved',title:'Household list',url:'https://keep.google.com/#NOTE/example-note',savedAt:'2026-10-18T20:00:00Z'}]});
  const restored=readData({getItem:key=>key===DATA_KEY?JSON.stringify(current):null});
  assert.deepEqual(restored.keepLinks,current.keepLinks);assert.equal(restored.notes[0].text,'Keep this');
  assert.deepEqual(mergeBackup(current,normalizeData()).keepLinks,current.keepLinks);
  assert.equal(mergeBackup(normalizeData(),current).keepLinks[0].title,'Household list');
  assert.deepEqual(normalizeData().keepLinks,[]);
});
test('recency uses only the dashboard save/open times and malformed entries cannot fabricate notes',()=>{
  const links=normalizeKeepLinks([null,{}, {id:'bad',title:'Fake',url:'https://evil.test/#NOTE/abc'},
    {id:'older',title:'<script>literal label</script>',url:'https://keep.google.com/#NOTE/older',savedAt:'2026-10-17T20:00:00Z',openedAt:'2026-10-18T22:00:00Z'},
    {id:'newer',title:'Saved today',url:'https://keep.google.com/#NOTE/newer',savedAt:'2026-10-18T20:00:00Z',openedAt:'invalid'}]);
  assert.equal(links.length,2);assert.equal(links[1].openedAt,'');assert.equal(recentKeepLinks(links)[0].id,'older');
  assert.equal(links[0].title,'<script>literal label</script>');assert.equal('noteText' in links[0],false);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createContext,runInContext} from 'node:vm';

const source=readFileSync(new URL('../js/steampunk-motion.js',import.meta.url),'utf8');
function fixture({theme='elven',hidden=false,intersection=true}={}) {
  class Element {
    children=[]; attributes=new Map(); dataset={};
    append(child){this.children.push(child);}
    setAttribute(name,value){this.attributes.set(name,value);}
    toggleAttribute(name,value){if(value)this.attributes.set(name,'');else this.attributes.delete(name);}
    hasAttribute(name){return this.attributes.has(name);}
  }
  const root=new Element(),header=new Element(),crest=new Element(),home=new Element(),listeners={};
  root.dataset.visualTheme=theme;
  const document={documentElement:root,hidden,createElement:()=>new Element(),
    getElementById:id=>({realmHeader:header,homePanel:home})[id],
    querySelector:selector=>selector==='.realm-ring'?crest:null,
    addEventListener:(name,fn)=>{listeners[name]=fn;}};
  let mutation,intersections;
  class MutationObserver {constructor(fn){mutation=fn;}observe(target,options){assert.equal(target,root);assert.deepEqual(Array.from(options.attributeFilter),['data-visual-theme']);}}
  class IntersectionObserver {constructor(fn){intersections=fn;}observe(target){assert.ok([header,crest,home].some(el=>el.children.includes(target)));}}
  const window=intersection?{IntersectionObserver}:{};
  runInContext(source,createContext({document,window,MutationObserver,IntersectionObserver}),{filename:'steampunk-motion.js'});
  const select=value=>{root.dataset.visualTheme=value;mutation();};
  const visibility=value=>{document.hidden=value;listeners.visibilitychange();};
  return {root,header,crest,home,select,visibility,intersect:(target,isIntersecting)=>intersections([{target,isIntersecting}])};
}

test('other themes do not construct or load clockwork; first Steampunk selection creates decorative wheels',()=>{
  const f=fixture();
  assert.equal(f.header.children.length,0);assert.equal(f.home.children.length,0);
  f.select('steampunk');
  for(const target of [f.header,f.crest,f.home]){
    assert.equal(target.children.length,1);
    assert.equal(target.children[0].attributes.get('aria-hidden'),'true');
    assert.equal(target.children[0].children.length,3);
  }
});

test('switching away pauses clockwork and repeated selections never duplicate assemblies',()=>{
  const f=fixture({theme:'steampunk'});
  assert.equal(f.root.hasAttribute('data-clockwork-paused'),false);
  for(const theme of ['gondor','steampunk','hobbit','steampunk']){
    f.select(theme);assert.equal(f.root.hasAttribute('data-clockwork-paused'),theme!=='steampunk');
    for(const target of [f.header,f.crest,f.home])assert.equal(target.children.length,1);
  }
});

test('hidden pages pause and visible pages resume the selected theme',()=>{
  const f=fixture({theme:'steampunk',hidden:true});
  assert.equal(f.root.hasAttribute('data-clockwork-paused'),true);
  f.visibility(false);assert.equal(f.root.hasAttribute('data-clockwork-paused'),false);
  f.visibility(true);assert.equal(f.root.hasAttribute('data-clockwork-paused'),true);
  f.select('elven');f.visibility(false);assert.equal(f.root.hasAttribute('data-clockwork-paused'),true);
});

test('offscreen gear groups pause independently and resume when visible',()=>{
  const f=fixture({theme:'steampunk'}),header=f.header.children[0],home=f.home.children[0];
  f.intersect(header,false);assert.equal(header.hasAttribute('data-clockwork-paused'),true);
  assert.equal(home.hasAttribute('data-clockwork-paused'),false);
  f.intersect(header,true);assert.equal(header.hasAttribute('data-clockwork-paused'),false);
});

test('clockwork still works without IntersectionObserver and retains page visibility pausing',()=>{
  const f=fixture({theme:'steampunk',intersection:false});
  assert.equal(f.header.children.length,1);
  f.visibility(true);assert.equal(f.root.hasAttribute('data-clockwork-paused'),true);
  f.visibility(false);assert.equal(f.root.hasAttribute('data-clockwork-paused'),false);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createContext,runInContext} from 'node:vm';

const source=readFileSync(new URL('../js/themes.js',import.meta.url),'utf8');
const key='sage_visual_theme_v1';
const themes=['hobbit','gondor','dwarven','elven'];

// A small DOM surface executes the actual browser script and observes its public
// controls, attributes and storage writes without exposing implementation hooks.
class Events {
  listeners=new Map();
  addEventListener(type,listener,options={}) {
    const listeners=this.listeners.get(type)||[];
    listeners.push({listener,once:options.once});this.listeners.set(type,listeners);
  }
  emit(type,event={}) {
    for(const entry of [...(this.listeners.get(type)||[])]) {
      entry.listener(event);
      if(entry.once)this.listeners.set(type,this.listeners.get(type).filter(item=>item!==entry));
    }
  }
}
class Element extends Events {
  constructor(tag='div',{id='',classes=[],attributes={},dataset={},parent=null}={}) {
    super();this.tagName=tag.toUpperCase();this.id=id;this.dataset={...dataset};this.parentElement=parent;
    this.attributes=new Map(Object.entries(attributes));this.value='';this.textContent='';this.writes=0;
    const values=new Set(classes);
    this.classList={contains:value=>values.has(value),remove:value=>values.delete(value),add:value=>values.add(value)};
  }
  getAttribute(name){return this.attributes.has(name)?this.attributes.get(name):null;}
  hasAttribute(name){return this.attributes.has(name);}
  setAttribute(name,value){this.attributes.set(name,String(value));this.writes++;this.attributeChanged?.(name);}
  removeAttribute(name){if(this.attributes.delete(name)){this.writes++;this.attributeChanged?.(name);}}
  closest(selectors) {
    for(let element=this;element;element=element.parentElement) {
      if(selectors.split(',').some(selector=>selector[0]==='#'?element.id===selector.slice(1):selector==='[data-visual-theme-button]'&&Object.hasOwn(element.dataset,'visualThemeButton')))return element;
    }
    return null;
  }
}
function fixture({saved=null,readBlocked=false,writeBlocked=false,loaded=false}={}) {
  const root=new Element('html'),body=new Element('body',{classes:['ember-mode']}),document=new Events(),window=new Events();
  const elements=[],observers=[],values=new Map(saved===null?[]:[[key,saved]]),storageWrites=[];
  const add=(tag,options={})=>{
    const element=new Element(tag,{parent:body,...options});elements.push(element);
    element.attributeChanged=name=>{
      for(const observer of observers)if(observer.options?.attributes&&(!observer.options.attributeFilter||observer.options.attributeFilter.includes(name)))observer.pending=true;
    };
    for(const observer of observers)if(observer.options?.childList)observer.pending=true;
    return element;
  };
  const buttons=Object.fromEntries(themes.map(theme=>[theme,add('button',{dataset:{visualThemeButton:theme}})]));
  const select=add('select',{id:'visualTheme'}),status=add('p',{id:'themeStatus'});
  const calendar=add('img',{attributes:{src:'assets/valinor/icon-calendar.webp',alt:'Calendar'}});
  const camera=add('img',{attributes:{src:'assets/valinor/icon-camera.webp',srcset:'assets/valinor/icon-camera.webp 160w',sizes:'32px'}});
  const emblem=add('img',{classes:['bag-end-emblem'],attributes:{src:'assets/personal-theme/bag-end.webp'}});
  const scroll=add('img',{classes:['ravens-scroll-art'],attributes:{src:'assets/valinor/elven-scroll.webp',srcset:'assets/valinor/elven-scroll.webp 1254w',width:'1254',height:'1254'}});
  const hearth=add('img',{id:'nestModeArt',attributes:{hidden:'',width:'144',height:'144',sizes:'(max-width: 760px) 88px, 128px'}});
  const picture=add('picture',{id:'nestCameraArt'});
  const cameraSource=add('source',{parent:picture,attributes:{srcset:'assets/valinor/background-960.webp',media:'(max-width: 1000px)'}});
  const cameraScene=add('img',{parent:picture,attributes:{src:'assets/valinor/background-1672.webp'}});
  const brand=add('img',{attributes:{src:'assets/logos/google.png',srcset:'assets/logos/google.png 64w'}});
  const sidebar=add('aside',{classes:['realm-sidebar']});
  const sidebarOriginals={
    overview:'assets/valinor/icon-calendar.webp',home:'assets/valinor/icon-home.webp',
    provisions:'assets/valinor/icon-provisions.webp',warroom:'assets/redesign/icon-war-room.webp',
    treasury:'assets/personal-theme/dwarven-vault.webp',settings:'assets/valinor/icon-settings.webp'
  };
  const sidebarIcons=Object.fromEntries(Object.entries(sidebarOriginals).map(([name,src])=>[name,add('img',{
    parent:sidebar,dataset:{sidebarIcon:name},attributes:{src,...(name==='overview'?{srcset:src+' 64w'}:{}),width:'28',height:'28'}
  })]));
  const panelSettings=add('img',{attributes:{src:'assets/valinor/icon-settings.webp',srcset:'assets/valinor/icon-settings.webp 160w',width:'42',height:'48'}});
  const protectedImages=['wowPanel','budgetPanel','budgetWorkspace','budgetDialog'].map(id=>{
    const panel=add('section',{id});
    return add('img',{parent:panel,attributes:{src:'assets/valinor/icon-calendar.webp',srcset:'assets/valinor/icon-calendar.webp 64w'}});
  });
  document.documentElement=root;document.body=loaded?body:null;document.readyState=loaded?'complete':'loading';
  document.getElementById=id=>elements.find(element=>element.id===id)||null;
  document.querySelectorAll=selector=>{
    assert.ok(document.body,'No artwork or controls should be queried before the DOM is ready');
    if(selector==='img,source')return elements.filter(element=>['IMG','SOURCE'].includes(element.tagName));
    if(selector==='[data-visual-theme-button]')return Object.values(buttons);
    throw Error('Unsupported selector in theme DOM fixture: '+selector);
  };
  const localStorage={
    getItem(name){if(readBlocked)throw Error('Storage blocked');return values.get(name)??null;},
    setItem(name,value){if(writeBlocked)throw Error('Storage blocked');values.set(name,value);storageWrites.push([name,value]);}
  };
  class MutationObserver {
    constructor(callback){this.callback=callback;this.pending=false;observers.push(this);}
    observe(target,options){assert.equal(target,body);assert.equal(options.childList,true);assert.equal(options.subtree,true);this.options=options;}
  }
  runInContext(source,createContext({document,window,localStorage,MutationObserver}),{filename:'themes.js'});
  const ready=()=>{document.body=body;document.readyState='interactive';document.emit('DOMContentLoaded');};
  const choose=theme=>document.emit('click',{target:new Element('span',{parent:buttons[theme]})});
  const change=theme=>{select.value=theme;select.emit('change',{target:select});};
  // Browser mutations are batched after synchronous renderer writes. Flush
  // subsequent self-authored attribute mutations too, with a loop guard.
  const mutation=()=>{
    let batches=0;
    while(observers.some(observer=>observer.pending)) {
      assert.ok(++batches<=12,'Theme artwork observer did not settle');
      for(const observer of observers.filter(observer=>observer.pending)){observer.pending=false;observer.callback([]);}
    }
    return batches;
  };
  return {root,body,document,window,buttons,select,status,calendar,camera,emblem,scroll,hearth,cameraSource,cameraScene,brand,sidebarIcons,sidebarOriginals,panelSettings,protectedImages,storageWrites,values,add,ready,choose,change,mutation};
}
function selected(f,theme) {
  assert.equal(f.root.dataset.visualTheme,theme);
  assert.equal(f.select.value,theme);
  for(const name of themes)assert.equal(f.buttons[name].getAttribute('aria-pressed'),String(name===theme));
}
const attributes=element=>Object.fromEntries(element.attributes);

test('saved theme is selected before DOM readiness, then artwork and controls adopt it',()=>{
  const f=fixture({saved:'dwarven'});
  assert.equal(f.document.body,null);assert.equal(f.root.dataset.visualTheme,'dwarven');
  assert.equal(f.calendar.getAttribute('src'),'assets/valinor/icon-calendar.webp');
  assert.deepEqual(f.storageWrites,[]);
  f.ready();selected(f,'dwarven');
  assert.equal(f.calendar.getAttribute('src'),'assets/themes/dwarven/icon-calendar.webp');
  assert.equal(f.body.classList.contains('ember-mode'),false);
});

test('absent, invalid and blocked stored preferences safely start with Elven',()=>{
  for(const options of [{},{saved:'mordor'},{saved:'__proto__'},{saved:'constructor'},{saved:'HOBBIT'},{saved:'hobbit',readBlocked:true}]) {
    const f=fixture(options);assert.equal(f.root.dataset.visualTheme,'elven');f.ready();selected(f,'elven');
    assert.equal(f.calendar.getAttribute('src'),'assets/valinor/icon-calendar.webp');assert.deepEqual(f.storageWrites,[]);
  }
});

test('header buttons and Settings synchronize their selected state and save the choice',()=>{
  const f=fixture();f.ready();f.choose('hobbit');selected(f,'hobbit');
  assert.equal(f.values.get(key),'hobbit');assert.match(f.status.textContent,/Hobbit theme selected/);
  f.change('gondor');selected(f,'gondor');assert.equal(f.values.get(key),'gondor');
  assert.equal(f.calendar.getAttribute('src'),'assets/themes/gondor/icon-calendar.webp');
  assert.match(f.status.textContent,/Gondor theme selected/);
  assert.deepEqual(f.storageWrites,[[key,'hobbit'],[key,'gondor']]);
});

test('blocked writes still switch the theme and explain that selection lasts for this visit',()=>{
  const f=fixture({writeBlocked:true});f.ready();f.choose('hobbit');selected(f,'hobbit');
  assert.equal(f.calendar.getAttribute('src'),'assets/themes/hobbit/icon-calendar.webp');
  assert.match(f.status.textContent,/Browser storage is unavailable.*this visit/);
  f.change('dwarven');selected(f,'dwarven');assert.deepEqual(f.storageWrites,[]);
});

test('returning to Elven restores exact image and source attributes after all other themes',()=>{
  const f=fixture(),images=[f.calendar,f.camera,f.emblem,f.cameraSource,f.cameraScene];
  const before=images.map(attributes);f.ready();
  for(const theme of ['hobbit','gondor','dwarven']) {
    f.choose(theme);assert.notEqual(f.camera.getAttribute('srcset'),before[1].srcset);
    assert.equal(f.camera.getAttribute('sizes'),'32px');
    assert.equal(f.cameraSource.hasAttribute('src'),false);
    f.choose('elven');assert.deepEqual(images.map(attributes),before);
  }
});

test('War Room, Treasury and company artwork remain unchanged through all theme switches',()=>{
  const f=fixture(),images=[...f.protectedImages,f.brand],before=images.map(attributes);f.ready();
  for(const theme of themes){f.choose(theme);assert.deepEqual(images.map(attributes),before);}
  assert.ok(images.every(image=>image.writes===0));
});

test('other tabs synchronize themes without writing them back; clearing storage restores Elven',()=>{
  const f=fixture();f.ready();
  f.window.emit('storage',{key,newValue:'gondor'});selected(f,'gondor');
  assert.equal(f.calendar.getAttribute('src'),'assets/themes/gondor/icon-calendar.webp');
  f.window.emit('storage',{key:'unrelated',newValue:'hobbit'});selected(f,'gondor');
  f.window.emit('storage',{key,newValue:'invalid'});selected(f,'elven');
  f.window.emit('storage',{key,newValue:'hobbit'});selected(f,'hobbit');
  f.window.emit('storage',{key:null,newValue:null});selected(f,'elven');
  assert.deepEqual(f.storageWrites,[]);
});

test('new shortcuts adopt the current theme and restore Elven without repeated attribute churn',()=>{
  const f=fixture({saved:'gondor',loaded:true});selected(f,'gondor');
  const icon=f.add('img',{attributes:{src:'assets/valinor/icon-settings.webp'}});
  f.mutation();assert.equal(icon.getAttribute('src'),'assets/themes/gondor/icon-settings.svg');
  const writes=icon.writes;f.mutation();assert.equal(icon.writes,writes);
  f.choose('elven');assert.equal(icon.getAttribute('src'),'assets/valinor/icon-settings.webp');
  assert.equal(icon.hasAttribute('srcset'),false);
});

test('mail scroll artwork switches with the theme and restores its exact Elven sources',()=>{
  const f=fixture(),before=attributes(f.scroll);f.ready();
  for(const theme of ['hobbit','gondor','dwarven']) {
    f.choose(theme);f.mutation();
    assert.equal(f.scroll.getAttribute('src'),`assets/themes/${theme}/scroll.webp`);
    assert.equal(f.scroll.hasAttribute('srcset'),false);
    assert.equal(f.scroll.getAttribute('width'),'1254');
    f.choose('elven');f.mutation();assert.deepEqual(attributes(f.scroll),before);
  }
});

test('unavailable hearth remains hidden and receives no manufactured active source',()=>{
  const f=fixture();f.ready();
  for(const theme of themes) {
    f.choose(theme);f.mutation();
    assert.equal(f.hearth.hasAttribute('hidden'),true);
    assert.equal(f.hearth.hasAttribute('src'),false);
    assert.equal(f.hearth.hasAttribute('srcset'),false);
  }
});

test('live thermostat heat and cool writes use the current realm and restore the latest Elven source',()=>{
  for(const theme of ['hobbit','dwarven','gondor']) {
    const f=fixture();f.ready();f.choose(theme);f.mutation();
    const family=theme==='gondor'?'dwarven':theme;
    for(const state of ['heat','cool','heat']) {
      const name=state==='heat'?'hobbit-heating-fireplace':'hobbit-cooling-open-window';
      const src=`assets/expansion/${name}.webp`;
      const srcset=`assets/expansion/${name}-small.webp 192w, assets/expansion/${name}.webp 288w`;
      // This is the existing thermostat renderer's synchronous source update.
      f.hearth.removeAttribute('hidden');f.hearth.setAttribute('src',src);f.hearth.setAttribute('srcset',srcset);
      f.mutation();
      assert.equal(f.hearth.getAttribute('src'),`assets/themes/${family}/hearth-${state}.webp`);
      assert.equal(f.hearth.hasAttribute('srcset'),false);
      assert.equal(f.hearth.hasAttribute('hidden'),false);
      const writes=f.hearth.writes;assert.equal(f.mutation(),0);assert.equal(f.hearth.writes,writes);
      f.choose('elven');f.mutation();
      assert.equal(f.hearth.getAttribute('src'),src);assert.equal(f.hearth.getAttribute('srcset'),srcset);
      f.choose(theme);f.mutation();
      assert.equal(f.hearth.getAttribute('src'),`assets/themes/${family}/hearth-${state}.webp`);
    }
    f.hearth.setAttribute('hidden','');f.choose('elven');f.mutation();
    assert.equal(f.hearth.hasAttribute('hidden'),true);
  }
});

test('approved Gondor and Elven sidebar illustrations take priority only for marked navigation icons',()=>{
  const f=fixture();f.ready();
  for(const theme of ['elven','gondor','elven']) {
    f.choose(theme);f.mutation();
    for(const [name,image] of Object.entries(f.sidebarIcons)) {
      assert.equal(image.getAttribute('src'),`assets/themes/${theme}/sidebar-icon-${name}.webp`);
      assert.equal(image.hasAttribute('srcset'),false);
      assert.equal(image.getAttribute('width'),'28');
    }
    assert.equal(f.calendar.getAttribute('src'),theme==='elven'?'assets/valinor/icon-calendar.webp':'assets/themes/gondor/icon-calendar.webp');
    assert.equal(f.panelSettings.getAttribute('src'),theme==='elven'?'assets/valinor/icon-settings.webp':'assets/themes/gondor/icon-settings.svg');
    assert.ok(!f.panelSettings.getAttribute('src').includes('sidebar-icon-'));
  }
});

test('Hobbit and Dwarven retain their navigation families including non-Valinor War Room and Treasury originals',()=>{
  const f=fixture();f.ready();
  const mappedIcons={overview:'calendar',home:'home',provisions:'provisions',settings:'settings'};
  for(const theme of ['gondor','hobbit','elven','dwarven','hobbit']) {
    f.choose(theme);f.mutation();
    for(const [name,image] of Object.entries(f.sidebarIcons)) {
      assert.doesNotMatch(image.getAttribute('src'),/undefined|null/);
      if(!['hobbit','dwarven'].includes(theme))continue;
      assert.equal(image.getAttribute('src'),mappedIcons[name]?`assets/themes/${theme}/icon-${mappedIcons[name]}.webp`:f.sidebarOriginals[name]);
    }
    if(['hobbit','dwarven'].includes(theme))assert.equal(f.sidebarIcons.overview.getAttribute('srcset'),`assets/themes/${theme}/icon-calendar.webp 160w`);
  }
});

test('Elven restores normal panel artwork exactly while retaining its approved new sidebar',()=>{
  const f=fixture(),panels=[f.calendar,f.camera,f.emblem,f.cameraSource,f.cameraScene,f.panelSettings,f.scroll];
  const before=panels.map(attributes);f.ready();
  for(const theme of ['gondor','dwarven','hobbit']){f.choose(theme);f.mutation();}
  f.choose('elven');f.mutation();assert.deepEqual(panels.map(attributes),before);
  assert.equal(f.sidebarIcons.overview.getAttribute('src'),'assets/themes/elven/sidebar-icon-overview.webp');
  assert.equal(f.sidebarIcons.warroom.getAttribute('src'),'assets/themes/elven/sidebar-icon-warroom.webp');
  assert.equal(f.sidebarIcons.treasury.getAttribute('src'),'assets/themes/elven/sidebar-icon-treasury.webp');
});

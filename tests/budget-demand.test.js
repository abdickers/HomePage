import test from 'node:test';
import assert from 'node:assert/strict';
import {createBudgetDemand} from '../js/budget-demand.js';
import {initBudget} from '../js/budget.js';

test('budget snapshots require use, coalesce duplicate reads and cache selected pages only in memory',async()=>{
 const calls=[];let finish;
 const demand=createBudgetDemand((key,signal)=>{calls.push({key,signal});return new Promise(resolve=>{finish=resolve;});});
 await assert.rejects(demand.read('month'),/Open the Treasury/);assert.equal(calls.length,0);
 demand.open();const first=demand.read('month'),second=demand.read('month');assert.equal(first,second);await Promise.resolve();assert.equal(calls.length,1);
 finish({saved:1});assert.deepEqual(await first,{saved:1});assert.deepEqual(await demand.read('month'),{saved:1});assert.equal(calls.length,1);
 demand.close();await assert.rejects(demand.read('month'));demand.open();await demand.read('month');assert.equal(calls.length,1);
 const fresh=demand.read('month',{force:true});await Promise.resolve();finish({saved:2});assert.deepEqual(await fresh,{saved:2});assert.equal(calls.length,2);
 demand.invalidate();const changed=demand.read('custom');await Promise.resolve();finish({saved:3});await changed;assert.equal(calls.length,3);
});

test('closing the Treasury or changing dates cancels pending reads and cannot cache their stale results',async()=>{
 const calls=[];const demand=createBudgetDemand((key,signal)=>new Promise(resolve=>calls.push({key,signal,resolve})));
 demand.open();const old=demand.read('old');await Promise.resolve();const next=demand.read('next');await Promise.resolve();assert.equal(calls[0].signal.aborted,true);
 calls[0].resolve({stale:true});await assert.rejects(old,{name:'AbortError'});
 demand.close();assert.equal(calls[1].signal.aborted,true);calls[1].resolve({stale:true});await assert.rejects(next,{name:'AbortError'});
 demand.open();const fresh=demand.read('old');await Promise.resolve();assert.equal(calls.length,3);calls[2].resolve({fresh:true});assert.deepEqual(await fresh,{fresh:true});
 const cancelled=demand.read('never');demand.close();await assert.rejects(cancelled,{name:'AbortError'});assert.equal(calls.length,3);
});

test('opening the homepage, restoring Google, and waiting do not request budget data; entrance and Refresh do',async t=>{
 const elements=new Map(),listeners=new Map();let subscriber,ready;
 const element=id=>{if(!elements.has(id))elements.set(id,{id,value:'',hidden:id==='treasuryContent',open:false,disabled:false,textContent:'',innerHTML:'',dataset:{},classList:{add(){},remove(){},toggle(){},contains(){return false;}},contains(){return false;},querySelectorAll(){return [];},querySelector(){return null;},setAttribute(){},replaceChildren(){},addEventListener(name,fn){this.handlers??={};this.handlers[name]=fn;},click(){this.handlers?.click?.({currentTarget:this,target:this});}});return elements.get(id);};
 const doc={hidden:false,activeElement:null,getElementById:element,addEventListener(name,fn){listeners.set(name,fn);},querySelectorAll(){return [];},querySelector(){return null;}};
 for(const [name,value] of Object.entries({document:doc,window:{addEventListener(){}},location:{search:''}})){
  const previous=Object.getOwnPropertyDescriptor(globalThis,name);Object.defineProperty(globalThis,name,{configurable:true,writable:true,value});
  t.after(()=>{if(previous)Object.defineProperty(globalThis,name,previous);else delete globalThis[name];});
 }
 const interval=t.mock.method(globalThis,'setInterval',()=>{throw Error('Budget installed an automatic timer');});
 const connection={connected:()=>true,sessionId:()=> 'test-session',subscribe(fn){subscriber=fn;return ()=>{};},ready:()=>new Promise(resolve=>{ready=resolve;})};
 const calls=[],data={environment:'sandbox',settings:{limits:[]},items:[],accounts:[],incomes:[],bills:[],mailSources:[],jobs:[],csvSources:[],csvImports:[],transactions:[],reviewCount:0,observations:[],summary:{availableCents:null,cashAccountCount:0,next7:[],next30:[],spending:{},review:[]}};
 const controller=initBudget({connection,serviceUrl:'https://dashboard.test',fetcher:async(url,options)=>{calls.push({url,options});const u=new URL(url);return Response.json({...data,retrievedAt:new Date().toISOString(),activity:{start:u.searchParams.get('activityStart'),end:u.searchParams.get('activityEnd'),complete:true,recent:[]}});}});
 const settled=async()=>{for(let i=0;i<12;i++)await new Promise(resolve=>setImmediate(resolve));};
 ready();subscriber(true);await settled();assert.equal(calls.length,0);assert.equal(interval.mock.callCount(),0);
 element('treasuryEntrance').click();await settled();assert.equal(calls.length,1);assert.match(calls[0].url,/activityStart=\d{4}-\d{2}-01/);
 element('treasuryClose').click();subscriber(true);await settled();assert.equal(calls.length,1);
 element('treasuryEntrance').click();await settled();assert.equal(calls.length,1);
 element('budgetRefresh').click();await settled();assert.equal(calls.length,2);
 controller.destroy();
});

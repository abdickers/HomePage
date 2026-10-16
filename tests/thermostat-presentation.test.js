import test from 'node:test';
import assert from 'node:assert/strict';
import {thermostatPresentation,THERMOSTAT_STALE_MS} from '../js/thermostat-presentation.js';
import {initTreasuryDisclosure} from '../js/treasury-disclosure.js';

const now=Date.parse('2026-10-16T19:30:00Z'),updatedAt=new Date(now).toISOString();
const state=(mode,hvac,options={})=>thermostatPresentation({online:'ONLINE',mode,hvac},{updatedAt,now,...options});
for(const [mode,hvac,art,label,activity] of [
 ['HEAT','HEATING','heat','Heat mode','Heating now'],['HEAT','OFF','heat','Heat mode','Idle'],
 ['COOL','COOLING','cool','Cool mode','Cooling now'],['COOL','OFF','cool','Cool mode','Idle'],
 ['HEATCOOL','HEATING','heat','Auto','Heating now'],['HEATCOOL','COOLING','cool','Auto','Cooling now'],
 ['HEATCOOL','OFF','neutral','Auto','Idle'],['HEATCOOL',undefined,'neutral','Auto','Activity unavailable'],
 ['HEAT',undefined,'heat','Heat mode','Activity unavailable'],['COOL',undefined,'cool','Cool mode','Activity unavailable'],
 ['OFF','OFF','neutral','Off','Idle']
])test(`${mode} / ${hvac??'unavailable'} keeps mode and actual HVAC activity distinct`,()=>{
 const view=state(mode,hvac);assert.equal(view.art,art);assert.equal(view.mode,label);assert.equal(view.activity,activity);assert.equal(view.stale,false);
});
test('Off never depicts a fire even if reported activity conflicts',()=>{
 for(const hvac of ['HEATING','COOLING',undefined]){const view=state('OFF',hvac);assert.equal(view.art,'neutral');assert.equal(view.mode,'Off');if(hvac)assert.match(view.activity,/mismatch/);}
});
test('Unknown and disconnected devices never inherit a previous mode illustration',()=>{
 for(const device of [null,{mode:'HEAT',online:'OFFLINE',hvac:'HEATING'},{mode:'HEAT',online:'UNKNOWN'},{mode:'UNSUPPORTED',online:'ONLINE',hvac:'COOLING'}]){
 const view=thermostatPresentation(device,{updatedAt,now});assert.equal(view.art,'neutral');assert.equal(view.mode,'Status unavailable');assert.doesNotMatch(view.activity,/now/);
 }
});
test('A fixed mode/activity conflict retains the confirmed mode and reports the disagreement',()=>{
 assert.equal(state('HEAT','COOLING').art,'heat');assert.match(state('HEAT','COOLING').activity,/Cooling reported.*mismatch/);
 assert.equal(state('COOL','HEATING').art,'cool');assert.match(state('COOL','HEATING').activity,/Heating reported.*mismatch/);
});
test('Retained readings become explicitly last known after failed refresh, missing time or three minutes',()=>{
 for(const options of [{stale:true},{updatedAt:undefined},{updatedAt:'invalid'},{now:now+THERMOSTAT_STALE_MS+1},{updatedAt:new Date(now+120000).toISOString()}]){
 const view=state('HEAT','HEATING',options);assert.equal(view.art,'heat');assert.equal(view.stale,true);assert.match(view.mode,/Last known/);assert.equal(view.activity,'Last reported: Heating');assert.doesNotMatch(view.activity,/now/);assert.equal(view.temperatureLabel,'Last reported temperature');
 }
});
test('Pending and rejected updates keep the confirmed mode, with explicit confirmation/error text',()=>{
 const pending=state('HEAT','OFF',{pending:true}),failed=state('HEAT','OFF',{failed:true});
 assert.equal(pending.art,'heat');assert.match(pending.note,/Waiting for confirmed/);assert.equal(failed.art,'heat');assert.equal(failed.mode,'Heat mode');assert.match(failed.note,/Change failed/);
});

function disclosureFixture(reduced=false){
 const map=new Map(),doc={activeElement:null,getElementById:id=>map.get(id)},timeouts=[];
 function element(id){const handlers={},attrs=new Map(),classes=new Set();const el={hidden:false,inert:false,setAttribute:(k,v)=>attrs.set(k,v),getAttribute:k=>attrs.get(k),addEventListener:(n,fn)=>handlers[n]=fn,click:()=>handlers.click(),contains:node=>node===el||node?.inside===id,focus(){doc.activeElement=el;},classList:{toggle(k,v){v?classes.add(k):classes.delete(k);},add:k=>classes.add(k),remove:k=>classes.delete(k),contains:k=>classes.has(k)}};map.set(id,el);return el;}
 for(const id of ['treasuryEntrance','treasuryContent','treasuryClose','budgetPanel','treasuryTransition'])element(id);
 const win={matchMedia:()=>({matches:reduced}),setTimeout:fn=>{timeouts.push(fn);return timeouts.length;}};
 const api=initTreasuryDisclosure(doc,win);return {doc,map,timeouts,api};
}
test('The budget disclosure starts hidden and inert, reveals one content tree, then restores inside focus',()=>{
 const {doc,map,timeouts}=disclosureFixture();const entrance=map.get('treasuryEntrance'),content=map.get('treasuryContent');
 assert.equal(content.hidden,true);assert.equal(content.inert,true);assert.equal(entrance.getAttribute('aria-expanded'),'false');
 entrance.click();assert.equal(entrance.hidden,true);assert.equal(content.hidden,false);assert.equal(content.inert,false);assert.equal(entrance.getAttribute('aria-expanded'),'true');assert.equal(doc.activeElement,map.get('treasuryClose'));
 timeouts[0]();assert.equal(map.get('treasuryTransition').hidden,true);
 doc.activeElement={inside:'treasuryContent'};map.get('treasuryClose').click();assert.equal(content.hidden,true);assert.equal(content.inert,true);assert.equal(doc.activeElement,entrance);
});
test('Reduced motion skips the door transition and closing does not steal unrelated focus',()=>{
 const {doc,map,timeouts,api}=disclosureFixture(true);map.get('treasuryEntrance').click();assert.equal(timeouts.length,0);assert.equal(map.get('treasuryTransition').hidden,true);
 const elsewhere={};doc.activeElement=elsewhere;api.setOpen(false);assert.equal(doc.activeElement,elsewhere);assert.equal(map.get('treasuryContent').inert,true);
});

import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const script=readFileSync(new URL('../js/personal-app-mode.js',import.meta.url),'utf8');
test('only the explicit personal app URL hides excluded sections',()=>{
 for(const search of ['', '?app=work','?app=personal-other']){
  const document={documentElement:{dataset:{}}};runInNewContext(script,{location:{search},document,URLSearchParams});assert.equal(document.documentElement.dataset.dashboardApp,undefined);
 }
 const document={documentElement:{dataset:{}}};runInNewContext(script,{location:{search:'?app=personal'},document,URLSearchParams});assert.equal(document.documentElement.dataset.dashboardApp,'personal');
});

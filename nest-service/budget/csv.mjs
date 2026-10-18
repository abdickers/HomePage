import {CSV_MAX_ROWS,CSV_TYPES,csvDate} from '../../js/bank-csv.mjs';
import {normalizeTransaction,today} from './domain.mjs';
import {BudgetError} from './plaid.mjs';

const fingerprint=async value=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))),b=>b.toString(16).padStart(2,'0')).join('');
export function csvLedgerView(rows) {
  const live=rows.some(t=>!t.removed&&t.source!=='csv'&&t.environment==='production');
  return rows.map(t=>t.source==='csv'?{...t,excludedFromTotals:live}:t);
}
export async function importCsv(store,input) {
  if(!input||input.confirmation!=='IMPORT CSV')throw new BudgetError(400,'Review the preview and confirm this CSV import.');
  const name=typeof input.accountLabel==='string'?input.accountLabel.replace(/\s+/g,' ').trim():'';
  if(!name||name.length>60)throw new BudgetError(400,'Use a short account nickname, without an account number.');
  if(!Array.isArray(input.rows)||!input.rows.length||input.rows.length>CSV_MAX_ROWS)throw new BudgetError(400,`Import 1–${CSV_MAX_ROWS} transactions at a time.`);
  // Validate the complete request before any write; never trust client parsing.
  const rows=input.rows.map((r,i)=>{
    if(!r||typeof r.date!=='string'||csvDate(r.date)!==r.date||r.date>today()||typeof r.description!=='string'||!r.description.trim()||r.description.trim().length>240||!Number.isSafeInteger(r.signedCents)||Math.abs(r.signedCents)>99999999999||!CSV_TYPES.includes(r.classification)||(r.classification==='income'&&r.signedCents<=0))throw new BudgetError(400,`Invalid CSV transaction at row ${i+1}. No transactions were imported.`);
    return {date:r.date,description:r.description.replace(/\s+/g,' ').trim(),signedCents:r.signedCents,classification:r.classification};
  });
  const sourceId='csv:'+await fingerprint(name.toLowerCase()),existing=await store.list('transaction');
  const existingIds=new Set(existing.map(t=>t.id)),occurrences=new Map(),added=[];
  const now=new Date().toISOString(),batchId='csv:'+crypto.randomUUID();
  for(const row of rows){
    const key=JSON.stringify([sourceId,row.date,row.description.toLowerCase(),row.signedCents]);
    const n=(occurrences.get(key)||0)+1;occurrences.set(key,n);
    const id='csv:'+await fingerprint(key+':'+n);
    if(existingIds.has(id))continue;
    const normalized=normalizeTransaction({transaction_id:id,account_id:sourceId,date:row.date,name:row.description,amount:0,iso_currency_code:'USD'},'manual');
    added.push({...normalized,amountCents:-row.signedCents,source:'csv',sourceId,batchId,classification:row.classification,importedAt:now});
  }
  const duplicates=rows.length-added.length;
  if(existing.length+added.length>10000)throw new BudgetError(400,'This import would exceed the ledger limit. Use a smaller export.');
  if(!added.length)return {saved:true,added:0,duplicates};
  const source={id:sourceId,name,rowCount:existing.filter(t=>t.sourceId===sourceId).length+added.length,lastImport:now};
  const batch={id:batchId,sourceId,name,added:added.length,duplicates,importedAt:now,transactionIds:added.map(t=>t.id)};
  // One parameterized set insert keeps a 500-row import within D1 query limits.
  await store.db.batch([
    store.statement("INSERT INTO budget_records(owner_id,kind,id,data,updated_at) SELECT ?,'transaction',json_extract(value,'$.id'),value,? FROM json_each(?)",store.owner,now,JSON.stringify(added)),
    store.putStatement('csv-source',sourceId,source),store.putStatement('csv-import',batchId,batch),
  ]);
  return {saved:true,added:added.length,duplicates,batchId};
}
export async function undoCsv(store,input) {
  if(!input||input.confirmation!=='UNDO CSV')throw new BudgetError(400,'Confirm Undo for this CSV import.');
  const batch=typeof input.id==='string'?await store.get('csv-import',input.id):null;
  if(!batch)throw new BudgetError(404,'CSV import not found.');
  const ids=JSON.stringify(batch.transactionIds),source=await store.get('csv-source',batch.sourceId);
  const remaining=(await store.list('transaction')).filter(t=>t.sourceId===batch.sourceId&&!batch.transactionIds.includes(t.id)).length;
  await store.db.batch([
    store.statement("DELETE FROM budget_records WHERE owner_id=? AND kind IN ('transaction','annotation') AND id IN (SELECT value FROM json_each(?))",store.owner,ids),
    store.statement("DELETE FROM budget_records WHERE owner_id=? AND kind='match-override' AND EXISTS (SELECT 1 FROM json_each(budget_records.data,'$.transactionIds') WHERE value IN (SELECT value FROM json_each(?)))",store.owner,ids),
    store.statement("DELETE FROM budget_records WHERE owner_id=? AND kind='csv-import' AND id=?",store.owner,batch.id),
    store.putStatement('csv-source',batch.sourceId,{...source,rowCount:remaining}),
  ]);
  return {removed:batch.added};
}

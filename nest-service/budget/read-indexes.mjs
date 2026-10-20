// Additive migration 0002. Normally applied by Wrangler before deployment.
// If the daily D1 allowance prevents that, the next explicit budget action can
// finish it once. Existing indexes skip all DDL; no timers or scheduled retries.
export const READ_INDEXES=[
  ['budget_record_lists','CREATE INDEX IF NOT EXISTS budget_record_lists ON budget_records(owner_id,kind,updated_at DESC,id)'],
  ['budget_pending_replacements',"CREATE INDEX IF NOT EXISTS budget_pending_replacements ON budget_records(owner_id,kind,json_extract(data,'$.pendingId'))"],
  ['budget_stage_pending',"CREATE INDEX IF NOT EXISTS budget_stage_pending ON budget_sync_stage(owner_id,source_id,generation,json_extract(data,'$.pendingId'))"],
  ['budget_live_history',"CREATE INDEX IF NOT EXISTS budget_live_history ON budget_records(owner_id) WHERE kind='transaction' AND json_extract(data,'$.environment')='production' AND COALESCE(json_extract(data,'$.source'),'')!='csv' AND COALESCE(json_extract(data,'$.removed'),0)=0"],
];
export async function ensureBudgetReadIndexes(db){
  const {results}=await db.prepare("SELECT name FROM sqlite_master WHERE type='index' AND name IN ('budget_record_lists','budget_pending_replacements','budget_stage_pending','budget_live_history')").all();
  const names=new Set(results.map(r=>r.name)),missing=READ_INDEXES.filter(([name])=>!names.has(name));
  if(missing.length)await db.batch(missing.map(([,sql])=>db.prepare(sql)));
}

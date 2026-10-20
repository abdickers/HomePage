-- Range reads use budget_dates from 0001; metadata lists and point lookups
-- should never sort or scan the owner's entire transaction history.
CREATE INDEX IF NOT EXISTS budget_record_lists ON budget_records(owner_id,kind,updated_at DESC,id);
CREATE INDEX IF NOT EXISTS budget_pending_replacements ON budget_records(owner_id,kind,json_extract(data,'$.pendingId'));
CREATE INDEX IF NOT EXISTS budget_stage_pending ON budget_sync_stage(owner_id,source_id,generation,json_extract(data,'$.pendingId'));
CREATE INDEX IF NOT EXISTS budget_live_history ON budget_records(owner_id)
 WHERE kind='transaction' AND json_extract(data,'$.environment')='production'
 AND COALESCE(json_extract(data,'$.source'),'')!='csv'
 AND COALESCE(json_extract(data,'$.removed'),0)=0;

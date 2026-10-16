-- Budget data never lives in the static repository or browser localStorage.
CREATE TABLE IF NOT EXISTS budget_records (
 owner_id TEXT NOT NULL, kind TEXT NOT NULL, id TEXT NOT NULL,
 data TEXT NOT NULL CHECK(json_valid(data)), updated_at TEXT NOT NULL,
 PRIMARY KEY(owner_id,kind,id)
);
CREATE INDEX IF NOT EXISTS budget_dates ON budget_records(owner_id,kind,json_extract(data,'$.date'));
CREATE TABLE IF NOT EXISTS budget_jobs (
 owner_id TEXT NOT NULL, id TEXT NOT NULL, kind TEXT NOT NULL, source_id TEXT NOT NULL,
 state TEXT NOT NULL DEFAULT '{}', status TEXT NOT NULL DEFAULT 'queued',
 next_run INTEGER NOT NULL DEFAULT 0, lease_until INTEGER NOT NULL DEFAULT 0,
 lease_id TEXT, last_success TEXT, error TEXT, updated_at TEXT NOT NULL,
 PRIMARY KEY(owner_id,id)
);
CREATE INDEX IF NOT EXISTS budget_jobs_ready ON budget_jobs(next_run,lease_until);
CREATE TABLE IF NOT EXISTS budget_sync_stage (
 owner_id TEXT NOT NULL, source_id TEXT NOT NULL, generation TEXT NOT NULL,
 id TEXT NOT NULL, operation TEXT NOT NULL, data TEXT NOT NULL CHECK(json_valid(data)),
 PRIMARY KEY(owner_id,source_id,generation,id)
);
CREATE TABLE IF NOT EXISTS budget_webhook_receipts (
 digest TEXT PRIMARY KEY, received_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS budget_owner_locks (
 owner_id TEXT PRIMARY KEY, lease_id TEXT NOT NULL, lease_until INTEGER NOT NULL
);

import {seedBills} from './domain.mjs';
export class BudgetStore {
  constructor(db,owner){this.db=db;this.owner=owner;}
  statement(sql,...values){return this.db.prepare(sql).bind(...values);}
  putStatement(kind,id,data){return this.statement('INSERT INTO budget_records(owner_id,kind,id,data,updated_at) VALUES(?,?,?,?,?) ON CONFLICT(owner_id,kind,id) DO UPDATE SET data=excluded.data,updated_at=excluded.updated_at',this.owner,kind,id,JSON.stringify({...data,id}),new Date().toISOString());}
  async put(kind,id,data){await this.putStatement(kind,id,data).run();return {...data,id};}
  async get(kind,id){const row=await this.statement('SELECT data FROM budget_records WHERE owner_id=? AND kind=? AND id=?',this.owner,kind,id).first();return row?JSON.parse(row.data):null;}
  async list(kind,limit=10001,offset=0){const {results}=await this.statement('SELECT data FROM budget_records WHERE owner_id=? AND kind=? ORDER BY updated_at DESC,id LIMIT ? OFFSET ?',this.owner,kind,limit,offset).all();return results.map(row=>JSON.parse(row.data));}
  async remove(kind,id){await this.statement('DELETE FROM budget_records WHERE owner_id=? AND kind=? AND id=?',this.owner,kind,id).run();}
  async initialize(){
    const exists=await this.get('settings','main');if(exists)return;
    const lock=await this.lock();if(!lock)throw Error('Budget setup is busy. Retry.');
    try{
    if(await this.get('settings','main'))return;
    const now=new Date().toISOString();
    const rows=[['settings','main',{generation:crypto.randomUUID(),cushionCents:null,coverageComplete:false,limits:[],createdAt:now}],...seedBills().map(b=>['bill',b.id,b])];
    await this.db.batch(rows.map(([kind,id,data])=>this.statement('INSERT OR IGNORE INTO budget_records(owner_id,kind,id,data,updated_at) VALUES(?,?,?,?,?)',this.owner,kind,id,JSON.stringify(data),now)));
    }finally{await this.unlock(lock);}
  }
  async queue(kind,sourceId,reset=false){
    const id=kind+':'+sourceId,now=new Date().toISOString();
    await this.statement("INSERT INTO budget_jobs(owner_id,id,kind,source_id,updated_at) VALUES(?,?,?,?,?) ON CONFLICT(owner_id,id) DO UPDATE SET next_run=0,status=CASE WHEN lease_until>? THEN status ELSE 'queued' END,updated_at=excluded.updated_at",this.owner,id,kind,sourceId,now,Date.now()).run();
    if(reset)await this.statement("UPDATE budget_jobs SET state='{}' WHERE owner_id=? AND id=? AND lease_until<?",this.owner,id,Date.now()).run();
  }
  async jobs(){const {results}=await this.statement('SELECT id,kind,source_id,status,next_run,last_success,error,updated_at FROM budget_jobs WHERE owner_id=? ORDER BY kind,source_id',this.owner).all();return results;}
  async lock(){const leaseId=crypto.randomUUID();return this.statement('INSERT INTO budget_owner_locks(owner_id,lease_id,lease_until) VALUES(?,?,?) ON CONFLICT(owner_id) DO UPDATE SET lease_id=excluded.lease_id,lease_until=excluded.lease_until WHERE budget_owner_locks.lease_until<? RETURNING lease_id',this.owner,leaseId,Date.now()+600000,Date.now()).first('lease_id');}
  async unlock(leaseId){await this.statement('DELETE FROM budget_owner_locks WHERE owner_id=? AND lease_id=?',this.owner,leaseId).run();}
  async lease(id){const leaseId=crypto.randomUUID(),now=Date.now();return this.statement("UPDATE budget_jobs SET lease_id=?,lease_until=?,status='running',updated_at=? WHERE owner_id=? AND id=? AND lease_until<? AND next_run<=? RETURNING *",leaseId,now+600000,new Date().toISOString(),this.owner,id,now,now).first();}
  async finish(job,state,{complete=false,error=null,delay=0}={}){
    await this.statement('UPDATE budget_jobs SET state=?,status=?,next_run=?,lease_until=0,lease_id=NULL,last_success=COALESCE(?,last_success),error=?,updated_at=? WHERE owner_id=? AND id=? AND lease_id=?',JSON.stringify(state),error?'error':complete?'idle':'queued',Date.now()+(delay||(complete?6*3600000:0)),complete?new Date().toISOString():null,error,new Date().toISOString(),this.owner,job.id,job.lease_id).run();
  }
  async deleteSource(kind,sourceId){
    const bills=(await this.list('bill')).filter(b=>b.sourceId===sourceId),defaults=new Map(seedBills().map(b=>[b.id,b]));
    const statements=[this.statement("DELETE FROM budget_records WHERE owner_id=? AND kind IN ('annotation','observation-override','match-override','event-override') AND id IN (SELECT id FROM budget_records WHERE owner_id=? AND (json_extract(data,'$.sourceId')=? OR json_extract(data,'$.itemId')=?))",this.owner,this.owner,sourceId,sourceId),this.statement("DELETE FROM budget_records WHERE owner_id=? AND kind='match-override' AND EXISTS (SELECT 1 FROM json_each(budget_records.data,'$.transactionIds') AS matched JOIN budget_records AS transaction_row ON transaction_row.owner_id=? AND transaction_row.kind='transaction' AND transaction_row.id=matched.value WHERE json_extract(transaction_row.data,'$.itemId')=?)",this.owner,this.owner,sourceId),this.statement("DELETE FROM budget_records WHERE owner_id=? AND (json_extract(data,'$.sourceId')=? OR json_extract(data,'$.itemId')=?) AND kind IN ('transaction','observation','account','event','proposal')",this.owner,sourceId,sourceId)];
    for(const bill of bills){if(bill.manual){const {sourceId:removedSource,sourceUrl,lastEvidenceAt,...manual}=bill;statements.push(this.putStatement('bill',bill.id,manual));}else if(defaults.has(bill.id))statements.push(this.putStatement('bill',bill.id,defaults.get(bill.id)));else statements.push(this.statement('DELETE FROM budget_records WHERE owner_id=? AND kind=? AND id=?',this.owner,'bill',bill.id));}
    statements.push(this.statement('DELETE FROM budget_jobs WHERE owner_id=? AND kind=? AND source_id=?',this.owner,kind==='bank'?'bank':'mail',sourceId),this.statement('DELETE FROM budget_sync_stage WHERE owner_id=? AND source_id=?',this.owner,sourceId),this.statement('DELETE FROM budget_records WHERE owner_id=? AND kind=? AND id=?',this.owner,kind==='bank'?'item':'mail-source',sourceId));
    await this.db.batch(statements);
  }
}

export const REMEMBER_DAYS=30;
export const sessionKey=kind=>'sage_private_session_v1_'+kind;
const valid=record=>record&&record.v===1&&/^[a-f0-9]{64}$/.test(record.session||'')&&Number.isFinite(record.expiresAt);
export function forgetSession(storage,kind){try{storage?.removeItem(sessionKey(kind));}catch{}}
export function readSession(storage,kind,origin,now=Date.now()){
 try{
  const record=JSON.parse(storage?.getItem(sessionKey(kind))||'null');
  if(valid(record)&&record.origin===origin&&record.expiresAt>now)return {session:record.session,expiresAt:record.expiresAt};
 }catch{}
 forgetSession(storage,kind);return null;
}
export function rememberSession(storage,kind,origin,session,expiresAt,now=Date.now()){
 const record={v:1,origin,session,expiresAt};
 if(!valid(record)||expiresAt<=now)return false;
 try{storage.setItem(sessionKey(kind),JSON.stringify(record));return true;}catch{return false;}
}

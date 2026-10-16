export class BudgetError extends Error {
  constructor(status,message,code='BUDGET_ERROR'){super(message);this.status=status;this.code=code;}
}
const allowed=new Set(['/institutions/search','/institutions/get_by_id','/link/token/create','/item/public_token/exchange','/item/get','/item/remove','/accounts/get','/accounts/balance/get','/transactions/sync','/webhook_verification_key/get']);
export function plaidEnvironment(env){return env.PLAID_ENV==='production'?'production':'sandbox';}
export function plaidConfigured(env){return !!(env.PLAID_CLIENT_ID&&env.PLAID_SECRET);}
export async function plaidCall(env,path,input,readJson) {
  if(!allowed.has(path))throw new BudgetError(400,'Unsupported bank operation.');
  if(!plaidConfigured(env))throw new BudgetError(503,'Plaid credentials have not been installed on the private service.','PLAID_SETUP');
  let response;
  try{response=await fetch(`https://${plaidEnvironment(env)}.plaid.com${path}`,{method:'POST',redirect:'manual',signal:AbortSignal.timeout(20000),headers:{'Content-Type':'application/json','Plaid-Version':'2020-09-14'},body:JSON.stringify({client_id:env.PLAID_CLIENT_ID,secret:env.PLAID_SECRET,...input})});}
  catch{throw new BudgetError(502,'The bank connection could not reach Plaid. Previously synced data is retained.','PLAID_UNREACHABLE');}
  if(response.status>=300&&response.status<400){await response.body?.cancel();throw new BudgetError(502,'Unexpected bank-service redirect; credentials were not forwarded.');}
  const result=await readJson(response,2097152);
  if(!response.ok){
    const code=/^[A-Z_]{1,100}$/.test(result.error_code||'')?result.error_code:'PLAID_ERROR';
    const message=code==='ITEM_LOGIN_REQUIRED'?'Your bank needs you to reconnect. Previously synced data is retained.':code.includes('RATE_LIMIT')?'Plaid is rate limiting requests. The sync will retry later.':code==='TRANSACTIONS_SYNC_MUTATION_DURING_PAGINATION'?'Bank history changed during pagination; restarting from the saved cursor.':code==='PRODUCT_NOT_READY'?'Plaid is still preparing transaction history. Retry later.':'Plaid could not complete this operation. Check the connection and product access.';
    throw new BudgetError(code.includes('RATE_LIMIT')?429:409,message,code);
  }
  return result;
}
export function institutionSupported(institution) {
  let hostname;try{hostname=new URL(institution.url).hostname.toLowerCase();}catch{return false;}
  return (hostname==='centralbank.net'||hostname.endsWith('.centralbank.net'))&&/central bank/i.test(institution.name||'')&&!/business|businesslink/i.test(institution.name||'')&&['balance','transactions'].every(product=>institution.products?.includes(product))&&institution.connection_availability!=='UNSUPPORTED';
}
export async function bankCandidates(env,readJson) {
  const result=await plaidCall(env,'/institutions/search',{query:plaidEnvironment(env)==='production'?'Central Bank':'First Platypus Bank',country_codes:['US'],products:['balance','transactions'],options:{include_optional_metadata:true}},readJson);
  const institutions=plaidEnvironment(env)==='production'?result.institutions.filter(institutionSupported):result.institutions;
  return institutions.map(i=>({id:i.institution_id,name:i.name,url:i.url||null,products:i.products,verification:plaidEnvironment(env)==='sandbox'?'sandbox-only':'provider-verified-domain-and-products'}));
}
const unbase64=value=>Uint8Array.from(atob(value.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));
export async function verifyWebhook(raw,jwt,getKey,now=Date.now()) {
  try{
    if(typeof jwt!=='string'||jwt.length>8192)return false;
    const parts=jwt.split('.');if(parts.length!==3)return false;
    const header=JSON.parse(new TextDecoder().decode(unbase64(parts[0])));
    if(header.alg!=='ES256'||!/^[A-Za-z0-9_-]{1,128}$/.test(header.kid||''))return false;
    const claims=JSON.parse(new TextDecoder().decode(unbase64(parts[1])));
    if(!Number.isInteger(claims.iat)||claims.iat*1000<now-300000||claims.iat*1000>now+30000||!/^[a-f0-9]{64}$/.test(claims.request_body_sha256||''))return false;
    const jwk=await getKey(header.kid);
    if(jwk.kid!==header.kid||jwk.alg!=='ES256'||jwk.kty!=='EC'||jwk.crv!=='P-256'||jwk.expired_at!==null||jwk.created_at>claims.iat)return false;
    const publicKey=await crypto.subtle.importKey('jwk',jwk,{name:'ECDSA',namedCurve:'P-256'},false,['verify']);
    if(!await crypto.subtle.verify({name:'ECDSA',hash:'SHA-256'},publicKey,unbase64(parts[2]),new TextEncoder().encode(parts[0]+'.'+parts[1])))return false;
    const hash=new Uint8Array(await crypto.subtle.digest('SHA-256',raw));
    const expected=Uint8Array.from(claims.request_body_sha256.match(/../g),x=>parseInt(x,16));
    let diff=0;for(let i=0;i<hash.length;i++)diff|=hash[i]^expected[i];return diff===0;
  }catch{return false;}
}

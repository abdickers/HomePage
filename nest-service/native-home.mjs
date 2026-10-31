import {CompactEncrypt,importSPKI} from 'jose';

const enc=new TextEncoder();
const hex=bytes=>Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
const digest=async value=>hex(new Uint8Array(await crypto.subtle.digest('SHA-256',enc.encode(value))));
const random=()=>hex(crypto.getRandomValues(new Uint8Array(32)));
const html=value=>String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
const validState=value=>/^[a-f0-9]{64}$/.test(value||'');
const failure=(status,message)=>Object.assign(new Error(message),{status});

function page(body,cookie=''){
 const nonce=random();return new Response(`<!doctype html><html><meta name="viewport" content="width=device-width,initial-scale=1"><title>Connect your personal realm</title><style nonce="${nonce}">body{font:18px system-ui;background:#101c2b;color:#e8edf4;max-width:560px;margin:8vh auto;padding:24px}h1{color:#e4ce9a}button,a{display:inline-block;background:#24364f;color:#fff;border:1px solid #d1b978;border-radius:12px;padding:14px 22px;font:inherit;text-decoration:none}p{line-height:1.6}</style><h1>Your personal realm</h1>${body}</html>`,{headers:{'Content-Type':'text/html;charset=UTF-8','Cache-Control':'private,no-store','Referrer-Policy':'no-referrer','Content-Security-Policy':`default-src 'none'; style-src 'nonce-${nonce}'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'`,...(cookie?{'Set-Cookie':cookie}:{})}});
}
async function publicKey(value){
 if(!/^[A-Za-z0-9_-]{300,800}$/.test(value||''))throw failure(400,'Invalid phone connection request. Start again in the app.');
 const base64=value.replaceAll('-','+').replaceAll('_','/');
 const pem='-----BEGIN PUBLIC KEY-----\n'+base64.match(/.{1,64}/g).join('\n')+'\n-----END PUBLIC KEY-----';
 try{const key=await importSPKI(pem,'RSA-OAEP-256');if(key.algorithm.modulusLength!==2048)throw Error();return key;}catch{throw failure(400,'Invalid phone connection key. Start again in the app.');}
}
async function form(request){
 const reader=request.body?.getReader();if(!reader)throw failure(400,'Missing connection request.');let text='',count=0;const decoder=new TextDecoder();try{for(;;){const {value,done}=await reader.read();if(done)break;if((count+=value.length)>2048)throw failure(413,'Connection request is too large.');text+=decoder.decode(value,{stream:true});}text+=decoder.decode();}finally{await reader.cancel().catch(()=>{});reader.releaseLock();}return new URLSearchParams(text);
}

/** Called only AFTER the existing signed Cloudflare Access guard. No public exception. */
export async function nativeHome(request,env,identity,{createSession,now=Date.now()}={}){
 try{
  const url=new URL(request.url);
  if(identity.email!=='abdickers@gmail.com'||identity.email!==env.OWNER_EMAIL?.toLowerCase())throw failure(403,'Use abdickers@gmail.com to connect your Home devices.');
  if(!env.NEST_KV)throw failure(503,'The personal connection is unavailable.');
  if(request.method==='GET'){
   if([...url.searchParams.keys()].some(key=>!['state','key'].includes(key))||url.searchParams.getAll('state').length!==1||url.searchParams.getAll('key').length!==1)throw failure(400,'Invalid connection request.');
   const state=url.searchParams.get('state'),key=url.searchParams.get('key');if(!validState(state))throw failure(400,'Start the Home connection in the phone app.');await publicKey(key);
   const csrf=random();await env.NEST_KV.put('native-home:'+await digest(state),JSON.stringify({key,csrf:await digest(csrf),expires:now+300000}),{expirationTtl:300});
   return page(`<p>Connect <strong>Middle-earth Command on your phone</strong> to Sage Cabin's current weather and Nest devices, including thermostat controls.</p><p>Only continue if you started this from the app. Google device credentials and the weather station key stay on this private server. This does not grant access to your budget, Gmail or Calendar.</p><form method="post" action="/native/home"><input type="hidden" name="state" value="${state}"><input type="hidden" name="csrf" value="${csrf}"><button>Connect this phone</button></form>`,`__Host-native-home=${csrf}; Secure; HttpOnly; SameSite=Strict; Path=/; Max-Age=300`);
  }
  if(request.method!=='POST')throw failure(405,'Use the connection button in the app.');
  if(url.search||request.headers.get('Origin')!==env.FRONTEND_ORIGIN||!request.headers.get('Content-Type')?.startsWith('application/x-www-form-urlencoded'))throw failure(403,'Untrusted connection request.');
  const input=await form(request),state=input.get('state'),csrf=input.get('csrf');if([...input.keys()].some(k=>!['state','csrf'].includes(k))||input.getAll('state').length!==1||input.getAll('csrf').length!==1||!validState(state)||!validState(csrf))throw failure(400,'Invalid connection request.');
  const cookie=request.headers.get('Cookie')?.match(/(?:^|;\s*)__Host-native-home=([a-f0-9]{64})(?:;|$)/)?.[1];if(cookie!==csrf)throw failure(403,'This connection belongs to another browser. Start again in the app.');
  const id='native-home:'+await digest(state),raw=await env.NEST_KV.get(id),record=raw?JSON.parse(raw):null;
  if(!record||record.expires<=now||record.csrf!==await digest(csrf))throw failure(403,'This connection expired. Start again in the app.');
  const key=await publicKey(record.key);await env.NEST_KV.delete(id);
  const accessJwt=request.headers.get('Cf-Access-Jwt-Assertion');if(!accessJwt||accessJwt.length>16384||identity.expiresAt<=now+60000)throw failure(403,'Your private-site sign-in is expiring. Sign in again.');
  const session=await createSession(env,identity.email);
  const payload={v:1,state,email:identity.email,origin:env.FRONTEND_ORIGIN,accessJwt,accessExpiresAt:identity.expiresAt,session:session.token,sessionExpiresAt:session.expires,expiresAt:now+120000};
  const encrypted=await new CompactEncrypt(enc.encode(JSON.stringify(payload))).setProtectedHeader({alg:'RSA-OAEP-256',enc:'A256GCM',typ:'command-home+jwe'}).encrypt(key);
  const callback='com.abdickers.realms://oauth/home#state='+state+'&response='+encrypted;
  return page(`<p>Your phone connection is ready.</p><a href="${html(callback)}">Return to Middle-earth Command</a><p>The encrypted return can be opened only by the phone that started this connection.</p>`,'__Host-native-home=; Secure; HttpOnly; SameSite=Strict; Path=/; Max-Age=0');
 }catch(error){
  const result=page(`<p>${html(error.status?error.message:'The Home connection could not finish. Your existing website connection is unchanged.')}</p>`);
  return new Response(result.body,{status:error.status||503,headers:result.headers});
 }
}

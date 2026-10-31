import gateway,{boundedJson,createNativeNestSession} from './worker.mjs';
import {nativeHome} from './native-home.mjs';
import {verifySiteAccess,AccessDenied} from './access-guard.mjs';
import {stationCurrent} from './station-weather.mjs';

const BASE_PATH='/HomePage/';
const CSP=[
  "default-src 'self'",
  "script-src 'self' https://cdn.plaid.com https://accounts.google.com/gsi/client",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://accounts.google.com/gsi/style",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' https: data: blob:",
  "connect-src 'self' https://api.weather.gov https://api.open-meteo.com https://geocoding-api.open-meteo.com https://api.rss2json.com https://hacker-news.firebaseio.com https://accounts.google.com https://*.googleapis.com https://production.plaid.com https://sandbox.plaid.com",
  "frame-src https://cdn.plaid.com https://accounts.google.com https://www.youtube-nocookie.com",
  "media-src 'self' blob:",
  "worker-src 'self' blob:",
  "object-src 'none'","base-uri 'self'","frame-ancestors 'none'","form-action 'self'","upgrade-insecure-requests"
].join('; ');

export function privateHeaders(response,{document=false,nonce=''}={}) {
  const result=new Response(response.body,response);
  result.headers.set('Cache-Control','private, no-store, max-age=0');
  result.headers.set('Pragma','no-cache');
  result.headers.set('X-Content-Type-Options','nosniff');
  result.headers.set('Referrer-Policy','no-referrer');
  result.headers.set('X-Frame-Options','DENY');
  result.headers.set('X-Robots-Tag','noindex, nofollow, noarchive');
  result.headers.set('Strict-Transport-Security','max-age=31536000');
  result.headers.set('Permissions-Policy','camera=(), microphone=(), geolocation=()');
  if(document)result.headers.set('Content-Security-Policy',nonce?CSP.replace("script-src 'self'",`script-src 'self' 'nonce-${nonce}'`):CSP);
  return result;
}

export function rewritePrivateDocument(response,nonce){
  return new HTMLRewriter()
    .on('head',{element(element){element.append(`<meta name="csp-nonce" content="${nonce}">`,{html:true});}})
    .on('script',{element(element){element.setAttribute('nonce',nonce);}})
    .transform(response);
}

export function createPrivateWorker({verify=verifySiteAccess,service=gateway,rewrite=rewritePrivateDocument,publicFetch=fetch}={}) {
  return {
    async fetch(request,env,ctx) {
      const url=new URL(request.url);
      // The sole public machine endpoint. Its existing Plaid JWT/body signature
      // verification stays mandatory; never bypass a prefix or arbitrary method.
      if(url.pathname==='/budget/plaid/webhook'&&request.method==='POST')return privateHeaders(await service.fetch(request,env,ctx));
      try {
        const identity=await verify(request,env);
        if(url.origin!==env.FRONTEND_ORIGIN)throw new AccessDenied();
        if(url.pathname==='/native/home')return privateHeaders(await nativeHome(request,env,identity,{createSession:createNativeNestSession}));
        if(url.pathname==='/__access/session'&&request.method==='GET')return privateHeaders(Response.json(identity));
        if(url.pathname==='/weather/current')return privateHeaders(await stationCurrent(request,env,{boundedJson}));
        if(url.pathname==='/'||url.pathname==='/HomePage')return privateHeaders(Response.redirect(url.origin+BASE_PATH,302));
        if(url.pathname.startsWith(BASE_PATH)) {
          if(!['GET','HEAD'].includes(request.method))return privateHeaders(new Response('Method not allowed',{status:405,headers:{Allow:'GET, HEAD'}}));
          if(!env.ASSETS)return privateHeaders(new Response('Private assets unavailable',{status:503}));
          // Existing scheduled GitHub jobs continue supplying public headlines
          // and event schedules, without granting CI new Cloudflare credentials.
          if(request.method==='GET'&&['/HomePage/data/news.json','/HomePage/data/wow.json'].includes(url.pathname)){
            try {
              const name=url.pathname.split('/').at(-1);
              const upstream=await publicFetch('https://raw.githubusercontent.com/abdickers/HomePage/main/data/'+name,{headers:{Accept:'application/json'},signal:AbortSignal.timeout(5000),cf:{cacheTtl:300,cacheEverything:true}});
              if(!upstream.ok)throw Error();
              return privateHeaders(Response.json(await boundedJson(upstream,1048576)));
            }catch{/* Keep the packaged dated snapshot; existing stale warnings apply. */}
          }
          const response=await env.ASSETS.fetch(request);
          const document=response.headers.get('Content-Type')?.includes('text/html');
          const nonce=document?crypto.randomUUID().replaceAll('-',''):'';
          return privateHeaders(document?rewrite(response,nonce):response,{document,nonce});
        }
        // Same-origin GET fetches omit Origin. Only synthesize it after signed
        // Access identity verification and browser fetch-metadata validation.
        let forwarded=request;
        if(request.method==='GET'&&!request.headers.has('Origin')&&request.headers.get('Sec-Fetch-Site')==='same-origin') {
          const headers=new Headers(request.headers);headers.set('Origin',env.FRONTEND_ORIGIN);
          forwarded=new Request(request,{headers});
        }
        return privateHeaders(await service.fetch(forwarded,env,ctx));
      }catch(error){
        return privateHeaders(Response.json({error:error instanceof AccessDenied?error.message:'The private site is temporarily unavailable.'},{status:error instanceof AccessDenied?error.status:503}));
      }
    },
    scheduled(event,env,ctx){return service.scheduled(event,env,ctx);}
  };
}
export default createPrivateWorker();

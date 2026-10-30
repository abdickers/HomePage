// Current station observations only. The read key stays in Worker secrets.
export const STATION_FRESH_MS=15*60*1000;
const number=(value,min,max)=>typeof value==='number'&&Number.isFinite(value)&&value>=min&&value<=max?value:null;
export function stationObservation(body,stationId,stationName,now=Date.now()){
 const sample=Array.isArray(body?.observations)?body.observations.find(row=>row?.stationID===stationId):null;
 const observed=number(sample?.epoch,0,1e11),time=observed===null?NaN:observed*1000;
 if(!Number.isFinite(time))return {configured:true,available:false,reason:'NO_OBSERVATIONS'};
 if(time>now+120000||now-time>STATION_FRESH_MS)return {configured:true,available:false,reason:'STALE',lastObservedAt:new Date(time).toISOString()};
 const imperial=sample.imperial||{},temp=number(imperial.temp,-150,170);
 if(temp===null)return {configured:true,available:false,reason:'NO_OBSERVATIONS'};
 return {configured:true,available:true,stationId,stationName,observation:{time:new Date(time).toISOString(),tempF:temp,humidity:number(sample.humidity,0,100),windMph:number(imperial.windSpeed,0,300),rainTodayIn:number(imperial.precipTotal,0,1000)}};
}
export async function stationCurrent(request,env,{fetcher=fetch,cache=globalThis.caches?.default,boundedJson,now=Date.now()}={}){
 const url=new URL(request.url);
 if(request.method!=='GET')return Response.json({error:'Use GET for current station weather.'},{status:405,headers:{Allow:'GET'}});
 if(url.search)return Response.json({error:'Station weather accepts no query parameters.'},{status:400});
 const stationId=String(env.WU_STATION_ID||'').trim().toUpperCase(),apiKey=String(env.WU_API_KEY||'').trim();
 if(!/^[A-Z0-9]{5,24}$/.test(stationId)||!/^[a-zA-Z0-9_-]{16,200}$/.test(apiKey))return Response.json({configured:false,available:false,reason:'NOT_CONFIGURED'});
 const name=String(env.WU_STATION_NAME||'Sage Cabin').slice(0,80),cacheKey=new Request(url.origin+'/.internal-cache/station-current/'+stationId);
 try{
  const saved=await cache?.match(cacheKey);
  if(saved){const result=await saved.json();if(result.available&&now-Date.parse(result.observation?.time)>STATION_FRESH_MS)return Response.json({configured:true,available:false,reason:'STALE',lastObservedAt:result.observation.time});return Response.json(result);}
 }catch{/* Cache failures must not prevent a current read. */}
 let result;
 try{
  const endpoint=new URL('https://api.weather.com/v2/pws/observations/current');
  endpoint.search=new URLSearchParams({stationId,format:'json',units:'e',numericPrecision:'decimal',apiKey}).toString();
  const response=await fetcher(endpoint.href,{headers:{Accept:'application/json'},redirect:'manual',signal:AbortSignal.timeout(8000)});
  if(response.status===204)result={configured:true,available:false,reason:'NO_OBSERVATIONS'};
  else if(!response.ok){await response.body?.cancel();result={configured:true,available:false,reason:[401,403].includes(response.status)?'CONNECTION_ERROR':response.status===429?'RATE_LIMITED':'UNAVAILABLE'};}
  else result=stationObservation(await boundedJson(response,65536),stationId,name,now);
 }catch{result={configured:true,available:false,reason:'UNAVAILABLE'};}
 // Only the sanitized observation is cached. Access validation precedes this handler.
 try{await cache?.put(cacheKey,new Response(JSON.stringify(result),{headers:{'Content-Type':'application/json','Cache-Control':'public, max-age='+(result.available?300:60)}}));}catch{}
 return Response.json(result);
}

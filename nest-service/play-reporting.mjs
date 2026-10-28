// Fixed read-only Reporting API endpoints. No D1, scheduled work or publishing API.
export const PLAY_SCOPE='https://www.googleapis.com/auth/playdeveloperreporting';
const API='https://playdeveloperreporting.googleapis.com/v1beta1/';
export class PlayError extends Error {constructor(status,message){super(message);this.status=status;}}
const validApp=value=>/^apps\/[A-Za-z0-9_.-]{1,250}$/.test(value||'');
export function metricWindow(date){
 const {year,month,day}=date||{};
 if(![year,month,day].every(Number.isInteger)||year<2020||month<1||month>12||day<1||day>31)return null;
 const end=new Date(Date.UTC(year,month-1,day));
 if(end.getUTCFullYear()!==year||end.getUTCMonth()!==month-1||end.getUTCDate()!==day)return null;
 const start=new Date(end.getTime()-7*86400000),shape=d=>({year:d.getUTCFullYear(),month:d.getUTCMonth()+1,day:d.getUTCDate(),timeZone:{id:'America/Los_Angeles'}});
 return {aggregationPeriod:'DAILY',startTime:shape(start),endTime:shape(end)};
}
export function latestMetric(rows,metric){
 const entries=(rows||[]).filter(row=>row.startTime).sort((a,b)=>{
  const key=r=>Date.UTC(r.startTime.year,r.startTime.month-1,r.startTime.day);
  return key(b)-key(a);
 });
 const row=entries[0],value=row?.metrics?.find(m=>m.metric===metric)?.decimalValue?.value;
 if(value===undefined||value===null||value==='')return {value:null,date:row?.startTime||null};
 const number=Number(value);return {value:Number.isFinite(number)&&number>=0?number:null,date:row.startTime};
}
export async function playOverview(url,token,{boundedJson,fetcher=fetch}={}){
 const cohort=url.searchParams.get('cohort')||'APP_TESTERS',selected=url.searchParams.get('app');
 if(!['APP_TESTERS','OS_PUBLIC'].includes(cohort)||selected&&!validApp(selected)||[...url.searchParams.keys()].some(k=>!['cohort','app'].includes(k))||url.searchParams.getAll('app').length>1||url.searchParams.getAll('cohort').length>1)throw new PlayError(400,'Choose a valid app and reporting audience.');
 async function read(path,body){
  let response;
   try{response=await fetcher(API+path,{method:body?'POST':'GET',headers:{Authorization:'Bearer '+token,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{}),redirect:'manual',signal:AbortSignal.timeout(8000)});}catch{throw new PlayError(502,'Play reporting could not be reached. Try again later.');}
  if(response.status>=300&&response.status<400){await response.body?.cancel();throw new PlayError(502,'Play returned an unexpected redirect.');}
  if(!response.ok){
   await response.body?.cancel();
   throw new PlayError(response.status===401?401:response.status===403?403:response.status===429?429:502,response.status===401?'Reconnect Play reporting.':response.status===403?'Enable Google Play Developer Reporting API in the gateway’s Google Cloud project and grant this Google account read access to your apps in Play Console.':response.status===429?'Play reporting is rate limited. Wait before refreshing.':response.status===404?'Google has no report for this app yet.':'Google could not provide this app report. Try again later.');
  }
  return boundedJson(response,524288);
 }
 const apps=[];let pageToken,more=false;
 // Two bounded catalogue pages; never traverse an entire account history.
 for(let page=0;page<2;page++){
  const response=await read('apps:search?'+new URLSearchParams({pageSize:'50',...(pageToken?{pageToken}:{})}));
  for(const app of response.apps||[])if(validApp(app.name)&&!apps.some(a=>a.name===app.name))apps.push({name:app.name,displayName:String(app.displayName||app.packageName||'Android app').slice(0,200),packageName:String(app.packageName||'').slice(0,250)});
  pageToken=response.nextPageToken;more=!!pageToken;if(!pageToken)break;
 }
 const active=selected?apps.find(app=>app.name===selected):null;
 if(selected&&!active)throw new PlayError(404,'That app is not in the accessible catalogue. Refresh the app list.');
 const result={apps,more,cohort,updatedAt:new Date().toISOString(),report:null};
 if(!active)return result; // Listing apps never fans out into metrics for every app.
 const report={app:active.name,crash:null,anr:null,notes:[]};
 await Promise.all([['crash','crashRateMetricSet','userPerceivedCrashRate7dUserWeighted'],['anr','anrRateMetricSet','userPerceivedAnrRate7dUserWeighted']].map(async([key,set,metric])=>{
  try{
   const metadata=await read(active.name+'/'+set),freshness=metadata.freshnessInfo?.freshnesses?.find(f=>f.aggregationPeriod==='DAILY');
   const timelineSpec=metricWindow(freshness?.latestEndTime);
   if(!timelineSpec){report.notes.push(`Google has no ${key==='anr'?'ANR':'crash'} data available yet.`);return;}
   const query=await read(active.name+'/'+set+':query',{timelineSpec,metrics:[metric],pageSize:7,userCohort:cohort});
   report[key]=latestMetric(query.rows,metric);
  }catch(error){if(error.status===401||error.status===403||error.status===429)throw error;report.notes.push(error.message);}
 }));
 result.report=report;return result;
}

export function stationWeather(result,unit='fahrenheit',now=Date.now()){
 if(!result?.available||!result.observation)return null;
 const observation=result.observation,time=Date.parse(observation.time),c=unit==='celsius';
 if(!Number.isFinite(time)||time>now+120000||now-time>15*60*1000||!Number.isFinite(observation.tempF))return null;
 return {temp:c?(observation.tempF-32)*5/9:observation.tempF,humidity:observation.humidity,
  wind:Number.isFinite(observation.windMph)?observation.windMph*(c?1.609344:1):null,
  rain:Number.isFinite(observation.rainTodayIn)?observation.rainTodayIn*(c?25.4:1):null,
  rainLabel:'Rain today',time:observation.time,description:'Live station readings',icon:'⌂',locationName:result.stationName||'Sage Cabin',source:'Weather Underground / '+result.stationId};
}

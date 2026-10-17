import {readSession,rememberSession,forgetSession,sessionKey} from './remembered-session.js';
import {paintThermostat} from './thermostat-presentation.js?v=20261016-expansion1';
// Remember only a revocable dashboard session. Google tokens stay on the service.
export function initNest(serviceUrl='') {
 const $=id=>document.getElementById(id),status=$('nestStatus');if(!status)return;
 const connect=$('nestConnect'),refresh=$('nestRefresh'),disconnect=$('nestDisconnect');
 let base;try{const u=new URL(serviceUrl);if(u.protocol!=='https:'||u.username||u.password)throw Error();base=u.origin;}catch{status.textContent='Private Nest hosting is being configured. Google Home is available below.';connect.disabled=true;return;}
 connect.disabled=true;
 let storage;try{storage=window.localStorage;}catch{}
 const saved=readSession(storage,'nest',base);
 let session=saved?.session||'',popup=null,devices=[],peer=null,stream=null,stopTimer=null,busy=false;
 let checkedAt=null,readFailed=false,commandPending=false,awaitingConfirmation=false,commandFailed=false;
 const message=text=>{status.textContent=text;};
 async function api(path,body){const r=await fetch(base+path,{method:body?'POST':'GET',headers:{Authorization:'Bearer '+session,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{}),cache:'no-store',credentials:'omit',signal:AbortSignal.timeout(20000)});const data=await r.json();if(!r.ok){if(r.status===401){session='';forgetSession(storage,'nest');refresh.disabled=true;disconnect.hidden=true;devices=[];void stop();renderThermostat();renderCamera();}throw Error(data.error||'Nest request failed.');}return data;}
 const fragment=new URLSearchParams(location.hash.slice(1));
 if(/^[a-f0-9]{64}$/.test(fragment.get('nest-session')||'')){session=fragment.get('nest-session');history.replaceState(null,'',location.pathname+location.search+'#homePanel');}
 const cToDisplay=(c,d)=>typeof c==='number'?Math.round(d.scale==='CELSIUS'?c:c*9/5+32):'—';
 const toC=(v,d)=>d.scale==='CELSIUS'?Number(v):(Number(v)-32)*5/9;
 const selected=kind=>devices.find(d=>d.id===$(kind==='thermostat'?'nestThermostat':'nestCamera').value);
 function options(id,list,preferred){const select=$(id),old=select.value;select.replaceChildren(...list.map(d=>new Option(d.name,d.id)));if(list.some(d=>d.id===old))select.value=old;else if(preferred){const match=list.find(d=>preferred.test(d.name));if(match)select.value=match.id;}select.hidden=list.length<2;}
 function paintClimate(){paintThermostat(document,selected('thermostat'),{updatedAt:checkedAt,stale:readFailed,pending:commandPending||awaitingConfirmation,failed:commandFailed});}
 function renderThermostat(){const d=selected('thermostat');paintClimate();$('nestControls').hidden=!d;$('nestTemperature').textContent=d?cToDisplay(d.temperature,d):'—';$('nestThermostatInfo').textContent=d?[d.name,d.humidity==null?'':d.humidity+'% humidity',d.eco==='MANUAL_ECO'?'Eco mode':''].filter(Boolean).join(' · '):'No thermostat shared with Sage Cabin.';
  if(!d)return;const mode=$('nestMode');mode.replaceChildren(...d.modes.map(v=>new Option(v==='HEATCOOL'?'Heat / Cool':v.toLowerCase(),v)));mode.value=d.mode;
  const unit=d.scale==='CELSIUS'?'°C':'°F';for(const side of ['heat','cool']){const field=$('nest'+(side==='heat'?'Heat':'Cool'));field.value=typeof d.setpoint[side+'Celsius']==='number'?cToDisplay(d.setpoint[side+'Celsius'],d):'';field.min=d.scale==='CELSIUS'?'10':'50';field.max=d.scale==='CELSIUS'?'32':'89.6';field.step=d.scale==='CELSIUS'?'0.5':'1';field.closest('label').hidden=side==='heat'?!['HEAT','HEATCOOL'].includes(d.mode):!['COOL','HEATCOOL'].includes(d.mode);$('nest'+(side==='heat'?'Heat':'Cool')+'Unit').textContent=unit;}
  $('nestApply').disabled=commandPending||awaitingConfirmation||d.online!=='ONLINE'||d.mode==='OFF'||d.eco==='MANUAL_ECO';$('nestModeApply').disabled=commandPending||awaitingConfirmation||d.online!=='ONLINE';
 }
 function renderCamera(){const d=selected('camera');$('nestPlay').disabled=!d||!d.protocols.includes('WEB_RTC');$('nestCameraInfo').textContent=d?(d.protocols.includes('WEB_RTC')?d.name+' · ready to watch':d.name+' · RTSP gateway required; view in Google Home'):'No camera shared with Sage Cabin.';}
 async function load(){if(!session||busy)return;const credential=session,confirming=awaitingConfirmation;busy=true;refresh.disabled=true;message('Checking the hearth and the gate…');try{const result=await api('/devices');if(session!==credential)return;devices=result.devices;checkedAt=result.updatedAt;readFailed=false;if(confirming)awaitingConfirmation=false;const remembered=rememberSession(storage,'nest',base,session,result.sessionExpiresAt);options('nestThermostat',devices.filter(d=>d.type==='THERMOSTAT'));options('nestCamera',devices.filter(d=>d.protocols.length),/outdoor|front|gate|porch/i);renderThermostat();renderCamera();message('Checked '+new Date(result.updatedAt).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'})+' · refreshes every minute'+(remembered?' · sign-in remembered':' · browser storage unavailable'));disconnect.hidden=false;connect.textContent='Reconnect Nest';}catch(e){readFailed=true;paintClimate();message(e.message);}finally{busy=false;refresh.disabled=!session;}}
 async function stop(){clearTimeout(stopTimer);const previous=stream;stream=null;peer?.close();peer=null;$('nestVideo').srcObject=null;$('nestVideo').hidden=true;$('nestCameraArt').hidden=false;$('nestStop').hidden=true;renderCamera();if(previous&&session){try{await api('/camera/stop',previous);}catch(e){message('Video closed. '+e.message);}}}
 connect.addEventListener('click',()=>{popup=window.open(base+'/auth/start','sageNestConnect','popup,width=620,height=760');message(popup?'Choose abdickers@gmail.com in the Nest window.':'Allow the Nest sign-in popup, then try again.');});
 window.addEventListener('message',async event=>{if(event.origin!==base||event.source!==popup||event.data?.type!=='sage-nest-connected'||!/^[a-f0-9]{64}$/.test(event.data.session||''))return;session=event.data.session;popup=null;await load();});
 refresh.addEventListener('click',load);$('nestThermostat').addEventListener('change',renderThermostat);$('nestCamera').addEventListener('change',async()=>{await stop();renderCamera();});
 async function control(input,button){const device=selected('thermostat');if(!device||commandPending||awaitingConfirmation)return;commandPending=true;commandFailed=false;renderThermostat();try{await api('/thermostat',{deviceId:device.id,...input});awaitingConfirmation=true;message('Nest accepted the change. Checking current state…');await load();}catch(e){commandFailed=true;awaitingConfirmation=false;message(e.message);}finally{commandPending=false;renderThermostat();}}
 $('nestModeApply').addEventListener('click',()=>control({action:'mode',mode:$('nestMode').value},$('nestModeApply')));
 $('nestApply').addEventListener('click',()=>{const d=selected('thermostat');if(!d)return;const fields=d.mode==='HEAT'?['Heat']:d.mode==='COOL'?['Cool']:['Heat','Cool'];if(fields.some(f=>!$('nest'+f).reportValidity()))return;void control({action:'setpoint',heatCelsius:toC($('nestHeat').value,d),coolCelsius:toC($('nestCool').value,d)},$('nestApply'));});
 $('nestPlay').addEventListener('click',async()=>{
  await stop();const d=selected('camera');if(!d)return;$('nestPlay').disabled=true;message('Opening the watch at the gate…');
  try{const pc=new RTCPeerConnection();peer=pc;pc.addTransceiver('audio',{direction:'recvonly'});pc.addTransceiver('video',{direction:'recvonly'});pc.createDataChannel('dataSendChannel');
   pc.ontrack=event=>{const video=$('nestVideo');video.srcObject=event.streams[0]||new MediaStream([event.track]);video.hidden=false;$('nestCameraArt').hidden=true;video.play().catch(()=>message('Press Play on the video to begin.'));};
   await pc.setLocalDescription(await pc.createOffer());
   await new Promise((resolve,reject)=>{if(pc.iceGatheringState==='complete')return resolve();const timer=setTimeout(()=>reject(Error('Camera network negotiation timed out.')),10000);pc.onicegatheringstatechange=()=>{if(pc.iceGatheringState==='complete'){clearTimeout(timer);resolve();}};});
   if(peer!==pc)return;const result=await api('/camera/start',{deviceId:d.id,offerSdp:pc.localDescription.sdp});stream={deviceId:d.id,mediaSessionId:result.mediaSessionId};
   await pc.setRemoteDescription({type:'answer',sdp:result.answerSdp});$('nestStop').hidden=false;
   pc.onconnectionstatechange=()=>{if(peer!==pc)return;if(pc.connectionState==='connected')message('The gate is in view · live private video');else if(['failed','disconnected'].includes(pc.connectionState)){message('Camera connection lost. Press Play to reconnect.');void stop();}};
   const remaining=Math.min(300000,Math.max(1000,Date.parse(result.expiresAt)-Date.now()-1000));stopTimer=setTimeout(()=>{message('Five-minute camera session ended. Press Play to watch again.');void stop();},remaining);
  }catch(e){message(e.message);await stop();}
 });
 $('nestStop').addEventListener('click',async()=>{await stop();message('The watch is resting.');});
 disconnect.addEventListener('click',async()=>{forgetSession(storage,'nest');await stop();try{await api('/disconnect',{});}catch{}session='';forgetSession(storage,'nest');devices=[];renderThermostat();renderCamera();refresh.disabled=true;disconnect.hidden=true;connect.textContent='Connect personal Nest';message('Signed out of this browser. Manage persistent Nest permissions in Google Home.');});
 window.addEventListener('storage',event=>{if(event.key!==sessionKey('nest'))return;const next=readSession(storage,'nest',base);if(!next){session='';devices=[];void stop();renderThermostat();renderCamera();refresh.disabled=true;disconnect.hidden=true;message('Signed out of Nest in another tab.');}else if(next.session!==session){session=next.session;void load();}});
 document.addEventListener('visibilitychange',()=>{paintClimate();if(document.hidden)void stop();});
 window.addEventListener('pagehide',()=>{peer?.close();peer=null;});
 setInterval(()=>{paintClimate();if(session&&!document.hidden&&!busy)void load();},60000);
 fetch(base+'/health',{cache:'no-store'}).then(r=>r.json()).then(r=>{connect.disabled=!r.configured;if(r.configured&&session)void load();else message(r.configured?'Connect Nest in Settings; this browser will remember your sign-in.':'Private service is online. Google credentials still need to be installed.');}).catch(()=>message('Private Nest service is unavailable. Open Google Home below.'));
}

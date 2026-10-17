// Playback belongs to a single selected camera. Late answers/tracks from a
// replaced attempt may clean up their own session, but cannot replace its view.
export function createNestCamera({getCamera,api,message,video,art,playButton,stopButton,
 createPeer=()=>new RTCPeerConnection(),createStream=()=>new MediaStream()}) {
 let current=null;
 const supported=camera=>camera?.protocols.includes('WEB_RTC');
 function render() {
  playButton.hidden=!!current;
  playButton.disabled=!!current||!supported(getCamera());
  stopButton.hidden=!current;
 }
 async function closeRemote(remote,report=false) {
  if(!remote)return;
  try { await api('/camera/stop',remote); }
  catch(e) { if(report&&!current)message('Video closed. '+e.message); }
 }
 async function stop() {
  const restoreFocus=stopButton.matches?.(':focus');
  const previous=current;current=null;
  if(previous) {
   clearTimeout(previous.stopTimer);
   previous.cancelIce?.();
   if(previous.pc) {
    previous.pc.ontrack=null;previous.pc.onconnectionstatechange=null;
    previous.pc.close();
   }
  }
  video.pause();video.srcObject=null;video.hidden=true;art.hidden=false;render();
  if(restoreFocus&&!playButton.disabled)playButton.focus({preventScroll:true});
  await closeRemote(previous?.remote,true);
 }
 async function start() {
  if(current)return;
  const camera=getCamera();if(!supported(camera)){render();return;}
  const restoreFocus=playButton.matches?.(':focus');
  const attempt={cameraId:camera.id};current=attempt;render();
  if(restoreFocus)stopButton.focus({preventScroll:true});
  message('Opening '+camera.name+'…');
  try {
   const pc=createPeer();attempt.pc=pc;
   pc.addTransceiver('audio',{direction:'recvonly'});
   pc.addTransceiver('video',{direction:'recvonly'});
   pc.createDataChannel('dataSendChannel');
   const received=createStream();
   pc.ontrack=event=>{
    if(current!==attempt)return;
    received.addTrack(event.track);
    video.srcObject=event.streams[0]||received;
    if(event.track.kind==='video') {
     video.hidden=false;art.hidden=true;
     video.play().catch(()=>{if(current===attempt)message('Press Play on the video to begin.');});
    }
   };
   pc.onconnectionstatechange=()=>{
    if(current!==attempt)return;
    if(pc.connectionState==='connected')message(camera.name+' · live private video');
    else if(['failed','disconnected'].includes(pc.connectionState)) {
     message('Camera connection lost. Choose Watch the gate to reconnect.');void stop();
    }
   };
   await pc.setLocalDescription(await pc.createOffer());
   if(current!==attempt)return;
   await new Promise((resolve,reject)=>{
    if(pc.iceGatheringState==='complete')return resolve();
    const finish=error=>{clearTimeout(timer);pc.onicegatheringstatechange=null;attempt.cancelIce=null;error?reject(error):resolve();};
    const timer=setTimeout(()=>finish(Error('Camera network negotiation timed out.')),10000);
    attempt.cancelIce=()=>finish();
    pc.onicegatheringstatechange=()=>{if(pc.iceGatheringState==='complete')finish();};
   });
   if(current!==attempt)return;
   const result=await api('/camera/start',{deviceId:camera.id,offerSdp:pc.localDescription.sdp});
   const remote={deviceId:camera.id,mediaSessionId:result.mediaSessionId};
   if(current!==attempt){await closeRemote(remote);return;}
   attempt.remote=remote;
   await pc.setRemoteDescription({type:'answer',sdp:result.answerSdp});
   if(current!==attempt)return;
   const remaining=Math.min(300000,Math.max(1000,Date.parse(result.expiresAt)-Date.now()-1000));
   attempt.stopTimer=setTimeout(()=>{if(current===attempt){message('Five-minute camera session ended. Choose Watch the gate to watch again.');void stop();}},remaining);
  } catch(e) {
   if(current===attempt){message(e.message);await stop();}
  }
 }
 async function switchCamera() {
  const resume=!!current;
  // Local teardown is synchronous; do not hold up the new camera on a remote
  // stop request. That request is tied to the previous mediaSessionId.
  void stop();
  if(resume)await start();
 }
 render();
 return {start,stop,switchCamera,render};
}

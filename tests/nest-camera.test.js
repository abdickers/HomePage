import test from 'node:test';
import assert from 'node:assert/strict';
import {createNestCamera} from '../js/nest-camera.js';

const tick=()=>new Promise(setImmediate);
const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};};
function fixture(t) {
 const calls=[],peers=[],messages=[];
 let selected={id:'front',name:'Front gate',protocols:['WEB_RTC']},startRequest=null;
 const video={hidden:true,srcObject:null,pause(){},play:async()=>{}},art={hidden:false},playButton={},stopButton={};
 const response=id=>({mediaSessionId:'session-'+id,answerSdp:'answer',expiresAt:new Date(Date.now()+300000).toISOString()});
 const watch=createNestCamera({getCamera:()=>selected,video,art,playButton,stopButton,message:text=>messages.push(text),
  api:async(path,body)=>{calls.push({path,body});if(path==='/camera/start')return startRequest?startRequest(body):response(body.deviceId);return {};},
  createStream:()=>({tracks:[],addTrack(track){this.tracks.push(track);}}),
  createPeer:()=>{const pc={iceGatheringState:'complete',connectionState:'new',localDescription:{sdp:'offer'},closed:false,
   addTransceiver(){},createDataChannel(){},createOffer:async()=>({type:'offer',sdp:'offer'}),setLocalDescription:async()=>{},
   async setRemoteDescription(){this.ontrack?.({track:{kind:'video'},streams:[]});this.connectionState='connected';this.onconnectionstatechange?.();},
   close(){this.closed=true;}};peers.push(pc);return pc;}
 });
 t.after(()=>watch.stop());
 return {watch,calls,peers,messages,video,art,playButton,stopButton,response,
  select:(id,protocols=['WEB_RTC'])=>{selected={id,name:id,protocols};},intercept:fn=>{startRequest=fn;}};
}
test('idle selection does not start video; a playing selection switches without another Watch click',async t=>{
 const f=fixture(t);f.select('side');await f.watch.switchCamera();assert.equal(f.calls.length,0);
 await f.watch.start();assert.equal(f.video.hidden,false);assert.equal(f.art.hidden,true);assert.equal(f.playButton.hidden,true);
 f.select('back');await f.watch.switchCamera();
 assert.deepEqual(f.calls.filter(c=>c.path==='/camera/start').map(c=>c.body.deviceId),['side','back']);
 assert.ok(f.calls.some(c=>c.path==='/camera/stop'&&c.body.deviceId==='side'));
 assert.equal(f.peers[0].closed,true);assert.equal(f.video.hidden,false);assert.equal(f.stopButton.hidden,false);
 await f.watch.stop();assert.equal(f.video.hidden,true);assert.equal(f.art.hidden,false);assert.equal(f.playButton.hidden,false);
 f.select('front');await f.watch.switchCamera();assert.equal(f.calls.filter(c=>c.path==='/camera/start').length,2);
});
test('rapid switches discard late session answers and tracks without interrupting the latest camera',async t=>{
 const f=fixture(t),late=deferred();f.intercept(body=>body.deviceId==='front'?late.promise:f.response(body.deviceId));
 const opening=f.watch.start();await tick();const staleTrack=f.peers[0].ontrack;
 f.select('back');await f.watch.switchCamera();const activeStream=f.video.srcObject;
 late.resolve(f.response('front'));await opening;
 staleTrack({track:{kind:'video'},streams:[{stale:true}]});
 assert.equal(f.video.srcObject,activeStream);assert.equal(f.video.hidden,false);
 assert.ok(f.calls.some(c=>c.path==='/camera/stop'&&c.body.mediaSessionId==='session-front'));
 assert.match(f.messages.at(-1),/back.*live private video/);
});
test('stop during negotiation cancels autoplay and releases a later remote session',async t=>{
 const f=fixture(t),late=deferred();f.intercept(()=>late.promise);
 const opening=f.watch.start();await tick();await f.watch.stop();late.resolve(f.response('front'));await opening;
 assert.equal(f.video.srcObject,null);assert.equal(f.video.hidden,true);assert.equal(f.art.hidden,false);
 assert.equal(f.playButton.hidden,false);assert.ok(f.calls.some(c=>c.path==='/camera/stop'));
});
test('a failed switch returns to the artwork and allows an explicit retry',async t=>{
 const f=fixture(t);await f.watch.start();f.intercept(async()=>{throw Error('Camera unavailable.');});f.select('back');await f.watch.switchCamera();
 assert.equal(f.video.hidden,true);assert.equal(f.playButton.hidden,false);assert.equal(f.playButton.disabled,false);
 assert.equal(f.messages.at(-1),'Camera unavailable.');
 f.intercept(null);await f.watch.start();assert.equal(f.video.hidden,false);
});
test('unsupported cameras stop playback and keep Google Home available without pretending to stream',async t=>{
 const f=fixture(t);await f.watch.start();f.select('legacy',['RTSP']);await f.watch.switchCamera();
 assert.equal(f.video.hidden,true);assert.equal(f.playButton.disabled,true);assert.equal(f.stopButton.hidden,true);
 assert.equal(f.calls.filter(c=>c.path==='/camera/start').length,1);
});
test('lost connections close the stream instead of leaving a stale live image',async t=>{
 const f=fixture(t);await f.watch.start();f.peers[0].connectionState='failed';f.peers[0].onconnectionstatechange();await tick();
 assert.equal(f.video.srcObject,null);assert.equal(f.art.hidden,false);assert.equal(f.playButton.hidden,false);
 assert.match(f.messages.at(-1),/connection lost/);
});
test('Watch and Stop pass keyboard focus to the newly visible action without scrolling',async t=>{
 const f=fixture(t),focused=[];
 f.playButton.matches=()=>true;f.stopButton.focus=options=>focused.push(['stop',options]);
 await f.watch.start();assert.deepEqual(focused,[['stop',{preventScroll:true}]]);
 f.stopButton.matches=()=>true;f.playButton.focus=options=>focused.push(['watch',options]);
 await f.watch.stop();assert.deepEqual(focused.at(-1),['watch',{preventScroll:true}]);
});

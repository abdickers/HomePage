export function youtubeId(value){
 try{const u=new URL(value);if(u.protocol!=='https:'||u.username||u.password)return null;
 const host=u.hostname.toLowerCase();let id;
 if(host==='youtu.be')id=u.pathname.slice(1);
 else if(['youtube.com','www.youtube.com','m.youtube.com'].includes(host))id=u.pathname==='/watch'?u.searchParams.get('v'):/^\/(shorts|embed)\//.test(u.pathname)?u.pathname.split('/')[2]:null;
 return /^[A-Za-z0-9_-]{11}$/.test(id||'')?id:null;
 }catch{return null;}
}
export function initMedia(storage){
 const box=document.getElementById('featuredVideo'),input=document.getElementById('videoUrl'),error=document.getElementById('videoError');
 const original=box.innerHTML,key='sage_featured_video';
 function render(id){box.replaceChildren();if(!id){box.innerHTML=original;return;}
 const play=document.createElement('button');play.type='button';play.className='video-empty';play.textContent='▶ Play pinned video';
 play.addEventListener('click',()=>{const frame=document.createElement('iframe');frame.src='https://www.youtube-nocookie.com/embed/'+id;frame.title='Pinned YouTube video';frame.allow='encrypted-media; picture-in-picture; fullscreen';frame.allowFullscreen=true;frame.referrerPolicy='strict-origin-when-cross-origin';box.replaceChildren(frame);});box.append(play);
 const source=document.createElement('a');source.href='https://www.youtube.com/watch?v='+id;source.textContent='Open on YouTube ↗';source.target='_blank';source.rel='noopener noreferrer';box.append(source);
 }
 let saved;try{saved=storage.getItem(key);}catch{}if(saved&&/^[A-Za-z0-9_-]{11}$/.test(saved))render(saved);
 document.getElementById('videoForm').addEventListener('submit',e=>{e.preventDefault();const id=youtubeId(input.value);if(!id){error.textContent='Use a valid HTTPS YouTube video link.';return;}render(id);try{storage.setItem(key,id);error.textContent='Video pinned in this browser.';}catch{error.textContent='Pinned for this session; browser storage is unavailable.';}});
 document.getElementById('clearVideo').addEventListener('click',()=>{try{storage.removeItem(key);}catch{}input.value='';error.textContent='';render(null);});
}

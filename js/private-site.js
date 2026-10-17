import {forgetSession} from './remembered-session.js';
import {NEST_SERVICE_URL} from './nest-config.js';

const card=document.getElementById('privateSiteAccess');
if(card&&location.origin===new URL(NEST_SERVICE_URL).origin){
  card.hidden=false;
  // A Back/Forward cache snapshot must not reveal a previous private screen
  // after site sign-out; restoring it goes through the server-side gate again.
  window.addEventListener('pagehide',()=>{document.documentElement.hidden=true;});
  window.addEventListener('pageshow',event=>{if(event.persisted)location.reload();});
  document.getElementById('privateSiteLogout').addEventListener('click',()=>{
    try{forgetSession(localStorage,'google');forgetSession(localStorage,'nest');}catch{}
    // Site sign-out leaves encrypted provider grants in the gateway intact.
    location.assign('/cdn-cgi/access/logout');
  });
}

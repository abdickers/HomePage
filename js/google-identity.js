let ready;
export function googleIdentity(){
 if(window.google?.accounts?.oauth2)return Promise.resolve();
 if(ready)return ready;
 ready=new Promise((resolve,reject)=>{
  const script=document.createElement('script');script.src='https://accounts.google.com/gsi/client';script.async=true;script.dataset.googleSignin='true';
  const timeout=setTimeout(()=>{script.remove();reject(Error('Google sign-in timed out. Please retry.'));},15000);
  script.onload=()=>{clearTimeout(timeout);window.google?.accounts?.oauth2?resolve():reject(Error('Google sign-in is unavailable.'));};
  script.onerror=()=>{clearTimeout(timeout);script.remove();reject(Error('Google sign-in could not load. Please retry.'));};document.head.append(script);
 }).catch(error=>{ready=null;throw error;});
 return ready;
}

import {createRemoteJWKSet,jwtVerify} from 'jose';

export const SITE_EMAILS=Object.freeze(['abdickers@gmail.com','dickersona@76fireworks.com']);
// Public signing keys only; no user identity or request data is cached here.
const signingKeys=new Map();
export class AccessDenied extends Error {
  constructor(status=403){super(status===503?'Private-site protection is not configured.':'Sign in to the private site with an authorized account.');this.status=status;}
}
export async function verifySiteAccess(request,env,{keySet}={}) {
  let issuer;
  try {
    const url=new URL(env.ACCESS_TEAM_DOMAIN);
    if(url.protocol!=='https:'||!/^[-a-z0-9]+\.cloudflareaccess\.com$/.test(url.hostname)||url.origin!==env.ACCESS_TEAM_DOMAIN)throw Error();
    issuer=url.origin;
    if(!/^[a-f0-9]{64}$/.test(env.ACCESS_AUD||''))throw Error();
  }catch{throw new AccessDenied(503);}
  const token=request.headers.get('Cf-Access-Jwt-Assertion');
  if(!token||token.length>16384)throw new AccessDenied();
  try {
    if(!keySet){
      if(!signingKeys.has(issuer)){
        if(signingKeys.size>=4)signingKeys.delete(signingKeys.keys().next().value);
        signingKeys.set(issuer,createRemoteJWKSet(new URL(issuer+'/cdn-cgi/access/certs'),{timeoutDuration:5000,cooldownDuration:30000,cacheMaxAge:600000}));
      }
      keySet=signingKeys.get(issuer);
    }
    const {payload}=await jwtVerify(token,keySet,{issuer,audience:env.ACCESS_AUD,algorithms:['RS256'],requiredClaims:['sub','email','exp','iat'],clockTolerance:5});
    if(payload.type!=='app'||typeof payload.email!=='string'||!SITE_EMAILS.includes(payload.email.toLowerCase()))throw Error();
    return {email:payload.email.toLowerCase(),expiresAt:payload.exp*1000};
  }catch{throw new AccessDenied();}
}

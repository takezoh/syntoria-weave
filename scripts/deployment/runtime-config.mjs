import {isIP} from 'node:net';

function exactHttpsOrigin(name,value){
 if(typeof value!=='string')throw new Error(name+' must be an exact HTTPS origin.');
 let url;try{url=new URL(value);}catch{throw new Error(name+' must be an exact HTTPS origin.');}
 if(url.protocol!=='https:'||url.username||url.password||url.pathname!=='/'||url.search||url.hash||url.origin!==value)throw new Error(name+' must be an exact HTTPS origin.');
 return url;
}

function parentDomain(value){
 if(typeof value!=='string'||value!==value.toLowerCase()||value.endsWith('.')||isIP(value)!==0)throw new Error('sharedCookieDomain must be a normalized multi-label DNS parent.');
 const labels=value.split('.');
 if(labels.length<2||!labels.every(label=>/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(label)))throw new Error('sharedCookieDomain must be a normalized multi-label DNS parent.');
 return value;
}

function underParent(host,parent,proper=false){return proper?host!==parent&&host.endsWith('.'+parent):host===parent||host.endsWith('.'+parent);}

/**
 * Fills the project identity of a tracked Cloud Run template, which carries only placeholder
 * project values: namespace, service account domain, image registry project and backup bucket.
 */
export function renderCloudRunManifest(manifest,settings){
 const rendered=structuredClone(manifest);
 if(!rendered?.metadata?.namespace)throw new Error('Cloud Run template must declare a namespace.');
 rendered.metadata.namespace=settings.projectNumber;
 const visit=node=>{
  if(Array.isArray(node)){for(const item of node)visit(item);return;}
  if(!node||typeof node!=='object')return;
  if(typeof node.serviceAccountName==='string')node.serviceAccountName=node.serviceAccountName.split('@')[0]+'@'+settings.project+'.iam.gserviceaccount.com';
  if(typeof node.image==='string'){const parts=node.image.split('/');if(parts.length<3)throw new Error('Cloud Run image must name its registry project.');parts[1]=settings.project;node.image=parts.join('/');}
  if(node.name==='BACKUP_BUCKET'&&typeof node.value==='string')node.value=settings.backupBucket;
  for(const value of Object.values(node))visit(value);
 };
 visit(rendered.spec);
 return rendered;
}

export function validateRuntimeSettings(value){
 const keys=['project','projectNumber','backupBucket','apiOrigin','gateOrigin','sharedCookieDomain','spaOrigins','appId','loginRedirectUri','browserClientId','gateResourceClientId'];
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(key=>!keys.includes(key)))throw new Error('Runtime settings contain unsupported configuration.');
 const api=exactHttpsOrigin('apiOrigin',value.apiOrigin),gate=exactHttpsOrigin('gateOrigin',value.gateOrigin),parent=parentDomain(value.sharedCookieDomain);
 if(!underParent(api.hostname,parent)||!underParent(gate.hostname,parent,true))throw new Error('API and Gate origins must use the configured cookie parent; Gate must be a subdomain.');
 if(!Array.isArray(value.spaOrigins)||value.spaOrigins.length===0||!value.spaOrigins.every(origin=>typeof origin==='string'))throw new Error('spaOrigins must be a nonempty array of exact HTTPS origins.');
 const spaOrigins=value.spaOrigins.map(origin=>{
  const parsed=exactHttpsOrigin('spaOrigins entry',origin);
  if(!underParent(parsed.hostname,parent))throw new Error('Every SPA origin must use the configured cookie parent.');
  return parsed.origin;
 });
 if(new Set(spaOrigins).size!==spaOrigins.length)throw new Error('spaOrigins must not contain duplicates.');
 if(typeof value.appId!=='string'||!/^[A-Za-z0-9._~-]{1,100}$/.test(value.appId))throw new Error('appId must be a registered Gate browser application ID.');
 if(typeof value.loginRedirectUri!=='string')throw new Error('loginRedirectUri must be an exact registered SPA return URI.');
 let redirect;try{redirect=new URL(value.loginRedirectUri);}catch{throw new Error('loginRedirectUri must be an exact registered SPA return URI.');}
 if(redirect.protocol!=='https:'||redirect.username||redirect.password||redirect.search||redirect.hash||redirect.href!==value.loginRedirectUri||!spaOrigins.includes(redirect.origin)||redirect.pathname!=='/auth-return.html')throw new Error('loginRedirectUri must be an exact registered SPA /auth-return.html URI.');
 if(typeof value.browserClientId!=='string'||!value.browserClientId.trim()||value.browserClientId!==value.browserClientId.trim())throw new Error('browserClientId is required.');
 if(typeof value.project!=='string'||!/^[a-z][a-z0-9-]{4,28}[a-z0-9]$/.test(value.project))throw new Error('project must be a GCP project ID.');
 if(typeof value.projectNumber!=='string'||!/^[1-9][0-9]{5,19}$/.test(value.projectNumber))throw new Error('projectNumber must be a GCP project number.');
 if(typeof value.backupBucket!=='string'||!/^[a-z0-9][a-z0-9._-]{1,61}[a-z0-9]$/.test(value.backupBucket))throw new Error('backupBucket must be a Cloud Storage bucket name.');
 if(typeof value.gateResourceClientId!=='string'||!value.gateResourceClientId.trim()||value.gateResourceClientId!==value.gateResourceClientId.trim())throw new Error('gateResourceClientId is required.');
 return Object.freeze({project:value.project,projectNumber:value.projectNumber,backupBucket:value.backupBucket,apiOrigin:api.origin,gateOrigin:gate.origin,sharedCookieDomain:parent,spaOrigins:Object.freeze(spaOrigins),appId:value.appId,loginRedirectUri:redirect.href,browserClientId:value.browserClientId,gateResourceClientId:value.gateResourceClientId});
}

/**
 * Static-host rules published with the SPA. Only the shell's own same-origin frame may embed the
 * workspace; no other page can be framed, so another site cannot overlay the signed-in app.
 */
export function spaHostingRules(){
 const headers=[
  '/*',
  '  X-Content-Type-Options: nosniff',
  '  Referrer-Policy: no-referrer',
  '  X-Frame-Options: DENY',
  "  Content-Security-Policy: frame-ancestors 'none'",
  '/workspace.html',
  '  ! X-Frame-Options',
  '  ! Content-Security-Policy',
  '  X-Frame-Options: SAMEORIGIN',
  "  Content-Security-Policy: frame-ancestors 'self'",
  '/runtime-config.json',
  '  Cache-Control: no-store',
  '/assets/*',
  '  Cache-Control: public, max-age=31536000, immutable',
 ];
 return Object.freeze({headers:headers.join('\n')+'\n',redirects:'/ /index.html 200\n'});
}

import {isIP} from 'node:net';

export type ServiceConfig=Readonly<{
 origin:string;issuer:string;resource:string;browserClientId:string;spaOrigins:readonly string[];sharedCookieDomain:string;
 gateClientId:string;gateClientSecret:string;
 databaseUrl:string;cursorEpoch:string;writeMode:'blocked'|'enabled';clientWriteApproval:'auto'|'blocked';port:number;localDatabase:boolean;
 /** Event delivery: the key ring sealing callback secrets, the Cloud Tasks queue and the task identity tokens must name. */
 webhookKeyRing:string;webhookTaskQueue:string;webhookTaskServiceAccount:string;
}>;

function required(env:NodeJS.ProcessEnv,key:string){const value=env[key];if(!value)throw new Error('Missing configuration: '+key);return value;}

function exactHttpsOrigin(name:string,value:string){
 let parsed:URL;
 try{parsed=new URL(value);}catch{throw new Error(name+' must be an HTTPS origin.');}
 if(parsed.protocol!=='https:'||parsed.username||parsed.password||parsed.pathname!=='/'||parsed.search||parsed.hash||parsed.origin!==value)throw new Error(name+' must be an exact HTTPS origin.');
 return parsed;
}

function dnsParent(value:string){
 const normalized=value.toLowerCase();
 const labels=normalized.split('.');
 if(value!==normalized||normalized.endsWith('.')||labels.length<2||isIP(normalized)!==0||!labels.every(label=>/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(label)))throw new Error('SHARED_COOKIE_DOMAIN must be a multi-label ASCII DNS parent without a port, path, wildcard, or trailing dot.');
 return normalized;
}

function underParent(host:string,parent:string,proper=false){
 return proper?host!==parent&&host.endsWith('.'+parent):host===parent||host.endsWith('.'+parent);
}

function parseSpaOrigins(value:string,parent:string){
 let parsed:unknown;
 try{parsed=JSON.parse(value);}catch{throw new Error('SPA_ORIGINS must be a JSON array of exact HTTPS origins.');}
 if(!Array.isArray(parsed)||parsed.length===0||!parsed.every(item=>typeof item==='string'))throw new Error('SPA_ORIGINS must be a nonempty JSON array of exact HTTPS origins.');
 const origins=parsed.map(item=>{
  const url=exactHttpsOrigin('SPA_ORIGINS entry',item as string);
  if(!underParent(url.hostname,parent))throw new Error('Every SPA origin must be under SHARED_COOKIE_DOMAIN.');
  return url.origin;
 });
 if(new Set(origins).size!==origins.length)throw new Error('SPA_ORIGINS must not contain duplicate origins.');
 return Object.freeze(origins);
}

export function readConfig(env:NodeJS.ProcessEnv):ServiceConfig {
 const originUrl=exactHttpsOrigin('PUBLIC_ORIGIN',required(env,'PUBLIC_ORIGIN'));
 const origin=originUrl.origin;
 const issuerValue=required(env,'OAUTH_ISSUER');let issuerUrl:URL;
 try{issuerUrl=new URL(issuerValue);}catch{throw new Error('OAUTH_ISSUER must be an HTTPS issuer origin.');}
 if(issuerUrl.protocol!=='https:'||issuerUrl.username||issuerUrl.password||issuerUrl.pathname!=='/'||issuerUrl.search||issuerUrl.hash)throw new Error('OAUTH_ISSUER must be an HTTPS issuer origin.');
 const issuer=issuerValue;
 const sharedCookieDomain=dnsParent(required(env,'SHARED_COOKIE_DOMAIN'));
 if(!underParent(issuerUrl.hostname,sharedCookieDomain,true))throw new Error('OAUTH_ISSUER must be a proper subdomain of SHARED_COOKIE_DOMAIN.');
 if(!underParent(originUrl.hostname,sharedCookieDomain))throw new Error('PUBLIC_ORIGIN must be under SHARED_COOKIE_DOMAIN.');
 const spaOrigins=parseSpaOrigins(required(env,'SPA_ORIGINS'),sharedCookieDomain);
 const databaseUrl=required(env,'DATABASE_URL'),localDatabase=env.LOCAL_DATABASE==='true';
 if(localDatabase&&(env.NODE_ENV==='production'||!['127.0.0.1','localhost','[::1]'].includes(new URL(databaseUrl).hostname)))throw new Error('Local database TLS exemption is restricted to local development.');
 const resource=required(env,'OAUTH_RESOURCE');if(resource!==origin+'/mcp')throw new Error('OAuth resource differs from canonical MCP URL.');
 const writeMode=env.WRITE_MODE??'blocked';if(writeMode!=='blocked'&&writeMode!=='enabled')throw new Error('Invalid WRITE_MODE.');
 const clientWriteApproval=env.CLIENT_WRITE_APPROVAL??'auto';if(clientWriteApproval!=='auto'&&clientWriteApproval!=='blocked')throw new Error('Invalid CLIENT_WRITE_APPROVAL.');
 const port=Number(env.PORT??8080);if(!Number.isInteger(port)||port<1||port>65535)throw new Error('Invalid PORT.');
 const browserClientId=required(env,'GATE_BROWSER_CLIENT_ID');
 const cursorEpoch=required(env,'CURSOR_EPOCH');if(!/^[0-9a-f-]{36}$/i.test(cursorEpoch))throw new Error('CURSOR_EPOCH must be a deployment UUID.');
 const webhookTaskQueue=required(env,'WEBHOOK_TASK_QUEUE');if(!/^projects\/[a-z][a-z0-9-]{4,28}[a-z0-9]\/locations\/[a-z0-9-]+\/queues\/[A-Za-z0-9-]{1,100}$/.test(webhookTaskQueue))throw new Error('WEBHOOK_TASK_QUEUE must be a Cloud Tasks queue path.');
 const webhookTaskServiceAccount=required(env,'WEBHOOK_TASK_SERVICE_ACCOUNT');if(!/^[a-z][a-z0-9-]{4,28}[a-z0-9]@[a-z][a-z0-9-]{4,28}[a-z0-9]\.iam\.gserviceaccount\.com$/.test(webhookTaskServiceAccount))throw new Error('WEBHOOK_TASK_SERVICE_ACCOUNT must be a service account email.');
 return Object.freeze({origin,issuer,resource,browserClientId,spaOrigins,sharedCookieDomain,gateClientId:required(env,'GATE_RESOURCE_CLIENT_ID'),gateClientSecret:required(env,'GATE_RESOURCE_CLIENT_SECRET'),databaseUrl,cursorEpoch,writeMode,clientWriteApproval,port,localDatabase,webhookKeyRing:required(env,'WEBHOOK_KEY_RING'),webhookTaskQueue,webhookTaskServiceAccount});
}

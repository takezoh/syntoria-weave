/** Creates one named HTTP task; resolving means the queue holds it. A name the queue already holds counts as created. */
export type TaskQueue=(name:string,path:string,body:Readonly<Record<string,unknown>>)=>Promise<void>;
export type AccessToken=()=>Promise<string>;

const METADATA_TOKEN='http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token';

/** The runtime service account's access token from the Cloud Run metadata server, reused until shortly before expiry. */
export function metadataAccessToken({fetch:fetcher=globalThis.fetch,now=()=>Date.now()}:{fetch?:typeof fetch;now?:()=>number}={}):AccessToken {
 let cached:{token:string;until:number}|null=null;
 return async()=>{
  if(cached&&cached.until>now())return cached.token;
  const response=await fetcher(METADATA_TOKEN,{headers:{'metadata-flavor':'Google'},signal:AbortSignal.timeout(2_000)});
  const value=await response.json().catch(()=>null) as {access_token?:unknown;expires_in?:unknown}|null;
  if(!response.ok||typeof value?.access_token!=='string'||typeof value.expires_in!=='number')throw new Error('Metadata access token unavailable.');
  cached={token:value.access_token,until:now()+Math.max(0,value.expires_in-60)*1_000};
  return cached.token;
 };
}

/**
 * Cloud Tasks HTTP targets on this service. Tasks carry an OIDC token for the dedicated task identity and audience, and the
 * service verifies it; neither queue headers nor the body grant authority.
 */
export function createCloudTasks({queue,origin,serviceAccount,audience,token,fetch:fetcher=globalThis.fetch,timeoutMs=3_000}:{
 queue:string;origin:string;serviceAccount:string;audience:string;token:AccessToken;fetch?:typeof fetch;timeoutMs?:number;
}):TaskQueue {
 if(!/^projects\/[a-z][a-z0-9-]{4,28}[a-z0-9]\/locations\/[a-z0-9-]+\/queues\/[A-Za-z0-9-]{1,100}$/.test(queue))throw new Error('WEBHOOK_TASK_QUEUE must be a Cloud Tasks queue path.');
 return async(name,path,body)=>{
  if(!/^[A-Za-z0-9_-]{1,500}$/.test(name))throw new Error('Invalid task name.');
  const response=await fetcher(`https://cloudtasks.googleapis.com/v2/${queue}/tasks`,{method:'POST',redirect:'error',signal:AbortSignal.timeout(timeoutMs),
   headers:{authorization:'Bearer '+await token(),'content-type':'application/json'},
   body:JSON.stringify({task:{name:`${queue}/tasks/${name}`,httpRequest:{httpMethod:'POST',url:origin+path,headers:{'content-type':'application/json'},
    body:Buffer.from(JSON.stringify(body),'utf8').toString('base64'),oidcToken:{serviceAccountEmail:serviceAccount,audience}}}})});
  await response.body?.cancel().catch(()=>{});
  if(response.ok||response.status===409)return;
  throw new Error('Cloud Tasks rejected the task with status '+response.status+'.');
 };
}

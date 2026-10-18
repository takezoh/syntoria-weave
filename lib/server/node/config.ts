export type ServiceConfig=Readonly<{
 origin:string;issuer:string;resource:string;webClientId:string;webClientSecret:string;
 databaseUrl:string;cursorEpoch:string;writeMode:'blocked'|'enabled';port:number;localDatabase:boolean;
 loginKey:Buffer;csrfKey:Buffer;
}>;
function required(env:NodeJS.ProcessEnv,key:string){const value=env[key];if(!value)throw new Error('Missing configuration: '+key);return value;}
export function readConfig(env:NodeJS.ProcessEnv):ServiceConfig {
 const origin=new URL(required(env,'PUBLIC_ORIGIN'));
 if(origin.origin!==origin.href.replace(/\/$/,''))throw new Error('PUBLIC_ORIGIN must have no path.');
 const issuer=new URL(required(env,'OAUTH_ISSUER'));
 if(origin.protocol!=='https:'||issuer.protocol!=='https:')throw new Error('Public identity endpoints must use HTTPS.');
 const databaseUrl=required(env,'DATABASE_URL'),localDatabase=env.LOCAL_DATABASE==='true';
 if(localDatabase&&(env.NODE_ENV==='production'||!['127.0.0.1','localhost','[::1]'].includes(new URL(databaseUrl).hostname)))throw new Error('Local database TLS exemption is restricted to local development.');
 const resource=required(env,'OAUTH_RESOURCE');if(resource!==origin.origin+'/mcp')throw new Error('OAuth resource differs from canonical MCP URL.');
 const writeMode=env.WRITE_MODE??'blocked';if(writeMode!=='blocked'&&writeMode!=='enabled')throw new Error('Invalid WRITE_MODE.');
 const port=Number(env.PORT??8080);if(!Number.isInteger(port)||port<1||port>65535)throw new Error('Invalid PORT.');
 const key=(name:string)=>{const bytes=Buffer.from(required(env,name),'base64url');if(bytes.length!==32)throw new Error(name+' must be a 32-byte base64url key.');return bytes;};
 const cursorEpoch=required(env,'CURSOR_EPOCH');if(!/^[0-9a-f-]{36}$/i.test(cursorEpoch))throw new Error('CURSOR_EPOCH must be a deployment UUID.');
 return Object.freeze({origin:origin.origin,issuer:issuer.href,resource,webClientId:required(env,'WEB_CLIENT_ID'),webClientSecret:required(env,'WEB_CLIENT_SECRET'),databaseUrl,cursorEpoch,writeMode,port,localDatabase,loginKey:key('LOGIN_ENCRYPTION_KEY'),csrfKey:key('CSRF_KEY')});
}

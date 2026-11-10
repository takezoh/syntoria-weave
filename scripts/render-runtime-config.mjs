import {cp,mkdir,readFile,rm,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {renderCloudRunManifest,spaHostingRules,validateRuntimeSettings} from './deployment/runtime-config.mjs';

const inputPath=resolve(process.argv[2]??'infra/.local/deployment.json');
const outputRoot=resolve('.local'),spaOutput=resolve(outputRoot,'spa'),cloudRunOutput=resolve(outputRoot,'cloud-run');
const settings=validateRuntimeSettings(JSON.parse(await readFile(inputPath,'utf8')));
const manifests=Object.fromEntries(await Promise.all(['production','migrator','backup'].map(async name=>[name,renderCloudRunManifest(JSON.parse(await readFile(resolve('infra/cloud-run',name+'.json'),'utf8')),settings)])));
const template=manifests.production;
const env=template.spec.template.spec.containers[0].env;
const values={PUBLIC_ORIGIN:settings.apiOrigin,OAUTH_ISSUER:settings.gateOrigin,OAUTH_RESOURCE:settings.apiOrigin+'/mcp',SHARED_COOKIE_DOMAIN:settings.sharedCookieDomain,SPA_ORIGINS:JSON.stringify(settings.spaOrigins),GATE_BROWSER_CLIENT_ID:settings.browserClientId,GATE_RESOURCE_CLIENT_ID:settings.gateResourceClientId};
for(const [name,value] of Object.entries(values)){
 const matches=env.filter(entry=>entry.name===name);
 if(matches.length!==1)throw new Error('Cloud Run template must contain exactly one '+name+' entry.');
 matches[0].value=value;
}
if(settings.authProvider==='access'){
 const access=settings.access;
 const additions={ACCESS_ISSUER:access.issuer,ACCESS_MCP_AUDIENCE:access.mcpAudience,ACCESS_BROWSER_AUDIENCE:access.browserAudience,ACCESS_OWNER_EMAIL:access.ownerEmail,OWNER_BINDING_ISSUER:access.ownerIssuer,OWNER_BINDING_SUBJECT:access.ownerSubject,BACKEND_HOSTS:access.backendHosts.join(',')};
 template.spec.template.spec.containers[0].env=env.filter(entry=>!entry.name.startsWith('GATE_')&&entry.name!=='OAUTH_ISSUER');
 for(const[name,value]of Object.entries(additions))template.spec.template.spec.containers[0].env.push({name,value});
}
await rm(spaOutput,{recursive:true,force:true});
await mkdir(spaOutput,{recursive:true});
await cp(resolve('dist/spa'),spaOutput,{recursive:true});
const hosting=spaHostingRules();
await writeFile(resolve(spaOutput,'_headers'),hosting.headers,{mode:0o644});
await writeFile(resolve(spaOutput,'_redirects'),hosting.redirects,{mode:0o644});
await writeFile(resolve(spaOutput,'runtime-config.json'),JSON.stringify(settings.authProvider==='access'?{apiOrigin:settings.spaOrigins[0],authProvider:'access',...(settings.appName?{appName:settings.appName}:{})}:{apiOrigin:settings.apiOrigin,gateOrigin:settings.gateOrigin,appId:settings.appId,loginRedirectUri:settings.loginRedirectUri,...(settings.appName?{appName:settings.appName}:{})})+'\n',{mode:0o644});
await mkdir(cloudRunOutput,{recursive:true});
for(const [name,manifest] of Object.entries(manifests))await writeFile(resolve(cloudRunOutput,name+'.json'),JSON.stringify(manifest,null,2)+'\n',{mode:0o600});
process.stdout.write('Rendered SPA runtime configuration, hosting rules and Cloud Run manifests under .local/.\n');

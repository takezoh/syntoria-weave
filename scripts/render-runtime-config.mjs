import {cp,mkdir,readFile,rm,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {validateRuntimeSettings} from './deployment/runtime-config.mjs';

const inputPath=resolve(process.argv[2]??'infra/.local/deployment.json');
const outputRoot=resolve('.local'),spaOutput=resolve(outputRoot,'spa'),cloudRunOutput=resolve(outputRoot,'cloud-run','production.json');
const settings=validateRuntimeSettings(JSON.parse(await readFile(inputPath,'utf8')));
const template=JSON.parse(await readFile(resolve('infra/cloud-run/production.json'),'utf8'));
const env=template.spec.template.spec.containers[0].env;
const values={PUBLIC_ORIGIN:settings.apiOrigin,OAUTH_ISSUER:settings.gateOrigin,OAUTH_RESOURCE:settings.apiOrigin+'/mcp',SHARED_COOKIE_DOMAIN:settings.sharedCookieDomain,SPA_ORIGINS:JSON.stringify(settings.spaOrigins),GATE_BROWSER_CLIENT_ID:settings.browserClientId,GATE_RESOURCE_CLIENT_ID:settings.gateResourceClientId};
for(const [name,value] of Object.entries(values)){
 const matches=env.filter(entry=>entry.name===name);
 if(matches.length!==1)throw new Error('Cloud Run template must contain exactly one '+name+' entry.');
 matches[0].value=value;
}
await rm(spaOutput,{recursive:true,force:true});
await mkdir(spaOutput,{recursive:true});
await cp(resolve('dist/spa'),spaOutput,{recursive:true});
await writeFile(resolve(spaOutput,'runtime-config.json'),JSON.stringify({apiOrigin:settings.apiOrigin,gateOrigin:settings.gateOrigin,appId:settings.appId,loginRedirectUri:settings.loginRedirectUri})+'\n',{mode:0o644});
await mkdir(resolve(outputRoot,'cloud-run'),{recursive:true});
await writeFile(cloudRunOutput,JSON.stringify(template,null,2)+'\n',{mode:0o600});
process.stdout.write('Rendered SPA runtime configuration and Cloud Run manifest under .local/.\n');

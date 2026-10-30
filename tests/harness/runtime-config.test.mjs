import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {renderCloudRunManifest,spaHostingRules,validateRuntimeSettings} from '../../scripts/deployment/runtime-config.mjs';

const example=JSON.parse(await readFile('infra/runtime-input.example.json','utf8'));

test('runtime settings bind the API, Gate and registered SPA to one trusted cookie parent',()=>{
 const settings=validateRuntimeSettings(example);
 assert.equal(settings.apiOrigin,'https://api.example.com');
 assert.equal(settings.gateOrigin,'https://gate.example.com');
 assert.deepEqual(settings.spaOrigins,['https://app.example.com']);
 assert.equal(settings.sharedCookieDomain,'example.com');
 assert.equal(settings.loginRedirectUri,'https://app.example.com/auth-return.html');
 assert(Object.isFrozen(settings));assert(Object.isFrozen(settings.spaOrigins));
});

test('runtime settings reject invalid scope, duplicate browser origins and unregistered return locations',()=>{
 assert.throws(()=>validateRuntimeSettings({...example,sharedCookieDomain:'com'}),/multi-label DNS parent/);
 assert.throws(()=>validateRuntimeSettings({...example,gateOrigin:'https://gate.other.test'}),/cookie parent/);
 assert.throws(()=>validateRuntimeSettings({...example,spaOrigins:[...example.spaOrigins,...example.spaOrigins]}),/must not contain duplicates/);
 assert.throws(()=>validateRuntimeSettings({...example,loginRedirectUri:'https://attacker.example.com/auth-return.html'}),/exact registered SPA/);
 assert.throws(()=>validateRuntimeSettings({...example,loginRedirectUri:'https://app.example.com/auth-return.html?next=https://attacker.example.com'}),/exact registered SPA/);
 assert.throws(()=>validateRuntimeSettings({...example,gateAllowedClientIds:['weave-mcp']}),/unsupported|unknown|gateAllowedClientIds/i);
 assert.throws(()=>validateRuntimeSettings({...example,project:'Example_Project'}),/project/);
 assert.throws(()=>validateRuntimeSettings({...example,projectNumber:'12'}),/projectNumber/);
 assert.throws(()=>validateRuntimeSettings({...example,backupBucket:'Invalid Bucket'}),/backupBucket/);
});

test('Cloud Run templates take their project identity only from the private runtime settings',async()=>{
 const settings=validateRuntimeSettings({...example,project:'private-project',projectNumber:'987654321098',backupBucket:'private-backups'});
 for(const name of ['production','migrator','backup']){
  const tracked=await readFile(`infra/cloud-run/${name}.json`,'utf8');
  assert.doesNotMatch(tracked,/private-project|987654321098/);
  const rendered=JSON.stringify(renderCloudRunManifest(JSON.parse(tracked),settings));
  assert.match(rendered,/"namespace":"987654321098"/);
  assert.match(rendered,/@private-project\.iam\.gserviceaccount\.com/);
  assert.match(rendered,/docker\.pkg\.dev\/private-project\/weave\//);
  assert.doesNotMatch(rendered,/example-project|123456789012/);
  if(name!=='production')assert.match(rendered,/"name":"BACKUP_BUCKET","value":"private-backups"/);
 }
});

test('SPA hosting rules forbid framing except the workspace inside its own shell',()=>{
 const {headers,redirects}=spaHostingRules();
 const rules=new Map();let current;
 for(const line of headers.trimEnd().split('\n')){if(!line.startsWith(' ')){current=[];rules.set(line,current);}else current.push(line.trim());}
 assert.deepEqual(rules.get('/*'),['X-Content-Type-Options: nosniff','Referrer-Policy: no-referrer','X-Frame-Options: DENY',"Content-Security-Policy: frame-ancestors 'none'"]);
 assert.deepEqual(rules.get('/workspace.html'),['! X-Frame-Options','! Content-Security-Policy','X-Frame-Options: SAMEORIGIN',"Content-Security-Policy: frame-ancestors 'self'"]);
 assert.deepEqual(rules.get('/runtime-config.json'),['Cache-Control: no-store']);
 assert.equal(rules.get('/assets/*')[0],'Cache-Control: public, max-age=31536000, immutable');
 assert.equal(redirects,'/ /index.html 200\n');
});

test('runtime settings accept an optional plain application name for the SPA title',()=>{
 assert.equal(validateRuntimeSettings(example).appName,null);
 assert.equal(validateRuntimeSettings({...example,appName:'Example Actions'}).appName,'Example Actions');
 for(const appName of ['',' padded ','x'.repeat(61),'bell\u0007',7])assert.throws(()=>validateRuntimeSettings({...example,appName}),/appName/);
});

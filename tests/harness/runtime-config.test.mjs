import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {validateRuntimeSettings} from '../../scripts/deployment/runtime-config.mjs';

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
 assert.throws(()=>validateRuntimeSettings({...example,gateAllowedClientIds:['weave-mcp']}),/include browserClientId/);
});

import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createGateConnectionCheck,ConnectionCheckUnknown} from '../../lib/server/node/gate-connection.ts';

const json=(value,{status=200,type='application/json'}={})=>new Response(typeof value==='string'?value:JSON.stringify(value),{status,headers:{'content-type':type}});
const input={subject:'person',connectionId:'connection-1',clientId:'client-1'};

test('the exact connection is checked online with resource authentication and only a boolean answer decides',async()=>{
 const calls=[];let answer=json({valid:true});
 const check=createGateConnectionCheck({issuer:'https://gate.example.test',clientId:'resource',clientSecret:'s3cret value',fetch:async(url,init)=>{calls.push({url,init});return answer;}});
 assert.equal(await check(input),'valid');
 answer=json({valid:false});assert.equal(await check(input),'invalid');
 assert.equal(calls.length,2,'no positive answer is cached');
 const [{url,init}]=calls;
 assert.equal(url,'https://gate.example.test/connections/check');assert.equal(init.method,'POST');assert.equal(init.redirect,'error');
 assert.equal(init.headers.authorization,'Basic '+Buffer.from('resource:s3cret+value').toString('base64'));
 assert.deepEqual(JSON.parse(init.body),{subject:'person',connection_id:'connection-1',client_id:'client-1'});
});

test('outages, credential rejection, redirects and malformed answers are unknown, never valid or invalid',async()=>{
 for(const respond of [()=>json({},{status:401}),()=>json({},{status:403}),()=>json({},{status:503}),()=>json({valid:'yes'}),()=>json([true]),()=>json('not json'),()=>json({valid:true},{type:'text/html'}),()=>{throw new TypeError('fetch failed');},()=>new Promise(()=>{})]){
  const check=createGateConnectionCheck({issuer:'https://gate.example.test',clientId:'resource',clientSecret:'secret',timeoutMs:100,fetch:async(url,init)=>{if(init.signal.aborted)throw init.signal.reason;return await Promise.race([respond(),new Promise((_,reject)=>init.signal.addEventListener('abort',()=>reject(init.signal.reason)))]);}});
  await assert.rejects(check(input),ConnectionCheckUnknown);
 }
});

test('Gate must be reached over HTTPS without credentials in the issuer',()=>{
 for(const issuer of ['http://gate.example.test','https://user:pw@gate.example.test','https://gate.example.test/?x=1'])assert.throws(()=>createGateConnectionCheck({issuer,clientId:'r',clientSecret:'s'}),TypeError);
 assert.doesNotThrow(()=>createGateConnectionCheck({issuer:'http://127.0.0.1:9',clientId:'r',clientSecret:'s',allowLoopbackHttp:true}));
});

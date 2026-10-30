import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Linter,ESLint} from 'eslint';
import {resolve} from 'node:path';
import ts from 'typescript';
import boundaries from '../../scripts/lint/boundaries.mjs';
function lint(code,filename){
 return new Linter().verify(ts.transpileModule(code,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ESNext}}).outputText,[{files:['**/*.{js,ts,mjs}'],plugins:{architecture:boundaries},rules:Object.fromEntries(Object.keys(boundaries.rules).map(key=>['architecture/'+key,'error'])),languageOptions:{ecmaVersion:'latest',sourceType:'module'}}],{filename:resolve(filename)});
}
const reports=(messages,rule)=>messages.some(item=>item.ruleId==='architecture/'+rule);
test('negative dependencies include extensionless aliases, re-exports and indirect capability shims',()=>{
 for(const source of ["import {x} from '@/lib/server/node/server';x();","export * from '@/lib/adapters/d1-action-store';","export * from '@/lib/domain/shim';"]){assert(reports(lint(source,'lib/mcp/local/server.mjs'),'private-composition'));}
 assert(!reports(lint("import {createActionUiResource} from '../ui-resource.ts';void createActionUiResource;",'lib/mcp/local/server.mjs'),'private-composition'));
 assert(reports(lint("import {createPostgresActionStore} from '@/lib/adapters/postgres/action-store';void createPostgresActionStore;",'lib/mcp/local/server.mjs'),'private-composition'));
 assert(reports(lint("export * from '@/lib/adapters/d1-action-store';",'lib/domain/shim.ts'),'capability-direction'));
 assert(reports(lint("import {x} from '../adapters/d1-action-store';x();",'lib/application/sample.ts'),'dependency-direction'));
});
test('negative native SQL aliases and computed calls fail outside exact adapter',()=>{
 for(const source of ["db.prepare('SELECT 1');","connection['prepare']('SELECT 1');","import {sql as q} from 'drizzle-orm';q.raw('x');","connection.exec('x');"]){assert(reports(lint(source,'lib/server/node/sample.ts'),'raw-sql-location'),source);}
});
async function actualLint(code,filePath){const [result]=await new ESLint({cwd:process.cwd()}).lintText(code,{filePath});return result.messages;}
test('actual repository config rejects private or D1 imports from public/local MCP',async()=>{
 for(const path of ['lib/mcp/local-server.mjs','lib/mcp/local/server.mjs','build/local-mcp-vite.config.mjs']){
  const original=readFileSync(path,'utf8');
  assert(!reports(await actualLint(original,path),'capability-direction'));
  assert(!reports(await actualLint(original,path),'private-composition'));
  for(const source of ["@/lib/adapters/d1-action-store.ts","@/lib/server/node/server.ts","drizzle-orm"]){
   const mutant=`import * as direct from '${source}';\n${original}\nvoid direct;\n`;
   assert(reports(await actualLint(mutant,path),'capability-direction')||reports(await actualLint(mutant,path),'private-composition'),path+': '+source);
  }
 }
});
test('Gate verification has one trusted authentication edge and regex exec is not SQL',async()=>{
 const code="import {createGateVerifier} from './gate-verifier';void createGateVerifier;";
 assert(!reports(await actualLint(code,'lib/server/node/authentication.ts'),'capability-direction'));
 assert(reports(await actualLint(code,'lib/server/node/server.ts'),'capability-direction'));
 assert(!reports(lint("const token=/^Bearer (.+)$/.exec(header);void token;",'lib/server/node/gate-verifier.ts'),'raw-sql-location'));
 assert(reports(lint("connection.exec('DELETE FROM state.actions');",'lib/server/node/gate-verifier.ts'),'raw-sql-location'));
});
test('D1 action adapter has no identity-issuer dependency',async()=>{
 const path='lib/adapters/d1-action-store.ts',source=readFileSync(path,'utf8');
 assert(!/VerifiedIdentity|verifiedUser|server\/auth|oai-authenticated-user/.test(source));
 assert(!reports(await actualLint(source,path),'capability-direction'));
 for(const dependency of ["import {requireUser} from '../server/auth';", "import {verifiedUser} from '../server/auth';"]){
  assert(reports(await actualLint(dependency+'\n'+source,path),'capability-direction'));
 }
});
test('user SQL checks execution forms and rejects D1 exec or extracted/computed prepare under actual config',async()=>{
 const source=readFileSync('lib/adapters/d1-action-store.ts','utf8');
 assert(!reports(await actualLint(source,'lib/adapters/d1-action-store.ts'),'user-sql'));
 for(const fixture of ['d1-exec.fixture','computed-prepare.fixture','prepare-alias.fixture','prepare-destructure.fixture','dynamic-method.fixture','computed-destructure.fixture','prepare-reflect.fixture','d1-dump.fixture']){
  const code=readFileSync('tests/fixtures/user-sql/'+fixture,'utf8');
  assert(reports(await actualLint(code,'lib/adapters/d1-action-store.ts'),'user-sql'),fixture+' must fail under the actual config');
 }
 const safe=readFileSync('tests/fixtures/user-sql/scoped-prepare.fixture','utf8');
 assert(!reports(await actualLint(safe,'lib/adapters/d1-action-store.ts'),'user-sql'));
});
test('removing owner WHERE, owner bind, or conflict key from actual adapter fails the gate',async()=>{
 const source=readFileSync('lib/adapters/d1-action-store.ts','utf8');
 assert(!reports(await actualLint(source,'lib/adapters/d1-action-store.ts'),'user-sql'));
 for(const mutant of [source.replace('WHERE owner=? AND operation_id=?','WHERE operation_id=?'),source.replace('.bind(user,operationId)','.bind(operationId)'),source.replace('ON CONFLICT(owner,','ON CONFLICT(')])assert(reports(await actualLint(mutant,'lib/adapters/d1-action-store.ts'),'user-sql'));
});
test('runtime sql.raw remains forbidden inside reviewed adapter',()=>{
 const source="import {sql} from 'drizzle-orm';sql.raw('arbitrary');";
 // The reviewed adapter may build closed native statements, never a raw ORM escape hatch.
 assert(reports(lint(source,'lib/adapters/d1-action-store.ts'),'user-sql')||reports(lint(source,'lib/adapters/d1-action-store.ts'),'raw-sql-location'));
});
test('DOM adapter public state is read-only and changes use controller events',async()=>{
 const path='lib/ui/effects/dom.js',source=readFileSync(path,'utf8');
 assert(!reports(await actualLint(source,path),'readonly-ui-state'));
 for(const mutant of [
  source.replace('function render(){','function render(){state.selectedId="changed";'),
  source.replace('function render(){','function render(){state.drafts.id.title="changed";'),
  source.replace('function render(){','function render(){state.batch++;'),
  source.replace('function render(){','function render(){state.batchIds.push("id");'),
  source.replace('function render(){','function render(){Object.assign(state.drafts.id,{title:"changed"});'),
 ])assert(reports(await actualLint(mutant,path),'readonly-ui-state'));
});
test('actual ESLint config rejects pure-model, component and controller boundary fixtures',async()=>{
 const fixtures=[
  ['model-imports-component.fixture','lib/ui/model/__architecture_fixture__.ts'],
  ['model-imports-effect-port.fixture','lib/ui/model/__architecture_fixture__.ts'],
  ['component-reexports-controller.fixture','lib/ui/components/__architecture_fixture__.ts'],
  ['controller-imports-dom.fixture','lib/ui/application/__architecture_fixture__.ts'],
  ['controller-dynamic-import.fixture','lib/ui/application/__architecture_fixture__.ts'],
 ];
 for(const [fixture,importer] of fixtures){
  const code=readFileSync('tests/fixtures/ui-boundaries/'+fixture,'utf8');
  assert(reports(await actualLint(code,importer),'dependency-direction'),fixture);
 }
 const capabilityCases=[
  ['model-dom-capability.fixture','lib/ui/model/__projection_fixture__.ts','ui-model-capability'],
  ['component-global-effects.fixture','lib/ui/components/__new_component_fixture__.ts','pure-effects'],
  ['application-sibling-import-effects.fixture','lib/ui/application/__new_controller_fixture__.ts','dependency-direction'],
  ['ui-unclassified-import.fixture','lib/ui/__new_unclassified_fixture__.ts','dependency-direction'],
 ];
 for(const [fixture,importer,rule] of capabilityCases){
  const code=readFileSync('tests/fixtures/ui-boundaries/'+fixture,'utf8');
  assert(reports(await actualLint(code,importer),rule),fixture+' must fail under the actual config');
 }
 const tsxCases=[
  ['model-tsx-dom-capability.fixture','lib/ui/model/__new_projection_fixture__.tsx','ui-model-capability'],
  ['component-tsx-global-effect.fixture','lib/ui/components/__new_component_fixture__.tsx','pure-effects'],
  ['application-sibling-tsx-effect.fixture','lib/ui/application/__new_controller_fixture__.tsx','dependency-direction'],
  ['tool-client-tsx-imports-application.fixture','lib/ui/effects/tool-client.tsx','dependency-direction'],
 ];
 for(const [fixture,importer,rule] of tsxCases){const code=readFileSync('tests/fixtures/ui-boundaries/'+fixture,'utf8');assert(reports(await actualLint(code,importer),rule),fixture+' must fail under the actual TSX config');}
 for(const [path,filename] of [['lib/ui/model/types.ts','lib/ui/model/types.ts'],['lib/ui/model/selection-context.ts','lib/ui/model/selection-context.ts'],['lib/ui/application/controller.ts','lib/ui/application/controller.ts'],['lib/ui/effects/dom.js','lib/ui/effects/dom.js'],['lib/ui/components/outline-list.ts','lib/ui/components/outline-list.ts']]){
  assert(!reports(await actualLint(readFileSync(path,'utf8'),filename),'dependency-direction'),filename);
  assert(!reports(await actualLint(readFileSync(path,'utf8'),filename),'pure-effects'),filename);
 }
});

test('actual repository config rejects inline type imports and import-equals across UI layers',async()=>{
 for(const path of ['lib/ui/model/new.ts','lib/ui/model/new.tsx','lib/ui/components/new.tsx','lib/ui/application/new.tsx']){
  for(const source of ['export type Leaked = import("@/lib/ui/effects/host").Whatever;','import Leaked = require("@/lib/ui/effects/host"); export {Leaked};']){
   assert(reports(await actualLint(source,path),'dependency-direction'),path+': '+source);
  }
 }
});

test('actual repository config guards every data-model extension and TypeScript import form',async()=>{
 const root='tests/fixtures/data-boundaries/';
 const fixtures=[
  ['runtime-type-alias.fixture','data-type-only'],
  ['empty-type-import.fixture','data-type-only'],
  ['type-import-effect.fixture','dependency-direction'],
  ['import-equals-effect.fixture','dependency-direction'],
  ['reexport-effect.fixture','dependency-direction'],
  ['dynamic-effect.fixture','dependency-direction'],
  ['nonliteral-dynamic.fixture','dependency-direction'],
  ['nonliteral-require.fixture','dependency-direction'],
 ];
 for(const extension of ['ts','tsx','mts','js','jsx','mjs']){
  for(const [fixture,rule] of fixtures){
   const code=readFileSync(root+fixture,'utf8');
   assert(reports(await actualLint(code,`lib/data/model/__boundary_fixture__.${extension}`),rule),`${extension}: ${fixture}`);
  }
 }
 for(const extension of ['ts','tsx','mts']){
  for(const fixture of ['type-import-effect.fixture','import-equals-effect.fixture'])assert(reports(await actualLint(readFileSync(root+fixture,'utf8'),`lib/data/model/__typed_fixture__.${extension}`),'dependency-direction'),`${extension}: ${fixture}`);
 }
 assert.deepEqual(await actualLint("import type { Snapshot } from '../types'; export type { Snapshot };",'lib/data/model/__valid_type_import__.ts'),[]);
 assert.deepEqual(await actualLint("export { type Snapshot } from '../types';",'lib/data/model/__valid_type_reexport__.ts'),[]);
 assert(reports(await actualLint(readFileSync(root+'runtime-type-definition.fixture','utf8'),'lib/data/types.ts'),'data-type-only'));
 assert(reports(await actualLint("import type { Snapshot } from '../types';",'lib/data/utils.ts'),'dependency-direction'));
 for(const filename of ['lib/data/model/__capability__.ts','lib/domain/__capability__.ts']){
  for(const name of ['D1Database','D1PreparedStatement','D1Result','KVNamespace','ExecutionContext','Env','WorkerEnv','D1Env'])assert(reports(await actualLint(`type Leaked = ${name};`,filename),'pure-effects'),filename+': '+name);
 }
 for(const source of ["import {UserActionStore} from '../../application/ports';", "import {createUserBoundActionStore} from '../../adapters/d1-action-store';", "import {env} from 'cloudflare:workers';", "Date.now();"]){
  const messages=await actualLint(source,'lib/data/model/__forbidden_dependency__.ts');
  assert(messages.some(item=>item.ruleId==='architecture/dependency-direction'||item.ruleId==='architecture/capability-direction'||item.ruleId==='architecture/pure-effects'),source);
 }
});

test('actual repository config keeps the perspective query kernel inside the pure domain boundary',async()=>{
 const filename='lib/domain/perspective-query.ts';
 const source=readFileSync(filename,'utf8');
 assert(!reports(await actualLint(source,filename),'pure-effects'));
 const fixtureRoot='tests/fixtures/perspective-query/';
 const valid=readFileSync(fixtureRoot+'pure.fixture','utf8');
 assert.deepEqual(await actualLint(valid,'lib/domain/__perspective_query_fixture__.ts'),[]);
 const invalid=readFileSync(fixtureRoot+'effect.fixture','utf8');
 assert(reports(await actualLint(invalid,'lib/domain/__perspective_query_fixture__.ts'),'pure-effects'));
});

test('UI collaboration shares only type declarations across the data boundary',async()=>{
 for(const path of ['lib/ui/model/sample.ts','lib/ui/application/sample.ts']){
  assert.equal((await actualLint("import type {Collaboration} from '../../data/types';export type Item=Collaboration;",path)).length,0);
  assert(reports(await actualLint("import {Collaboration} from '../../data/types';void Collaboration;",path),'data-type-only'));
  assert(reports(await actualLint("import {planStorageCommit} from '../../data/model/storage';void planStorageCommit;",path),'dependency-direction'));
 }
});

test('MCP subscription effects stay on their reviewed adapter and composition edges',async()=>{
 assert.deepEqual(await actualLint("import {createMcpSubscriptions} from '../../adapters/postgres/mcp-subscriptions';void createMcpSubscriptions;",'lib/server/node/main.ts'),[]);
 assert(reports(await actualLint("import {createMcpSubscriptions} from '../../adapters/postgres/mcp-subscriptions';void createMcpSubscriptions;",'lib/ui/model/sample.ts'),'capability-direction'));
 assert(reports(await actualLint("client.query('SELECT 1');",'lib/application/sample.ts'),'raw-sql-location'));
});
test('actual repository config keeps webhook mechanics pure and their store on its exact capability edge',async()=>{
 for(const path of ['lib/webhook/subscriptions.ts','lib/webhook/destination.ts','lib/webhook/signing.ts','lib/webhook/ports.ts','lib/adapters/postgres/webhook-store.ts','lib/server/node/webhook-events.ts'])
  assert.deepEqual((await actualLint(readFileSync(path,'utf8'),path)).filter(item=>item.ruleId?.startsWith('architecture/')),[],path);
 for(const code of ['export const now=()=>Date.now();','export const id=()=>crypto.randomUUID();','export const read=()=>fetch("https://example.com");'])
  assert(reports(await actualLint(code,'lib/webhook/sample.ts'),'pure-effects'),code);
 assert(reports(await actualLint("import {createWebhookSubscriptions} from '../../adapters/postgres/webhook-store';void createWebhookSubscriptions;",'lib/server/node/server.ts'),'capability-direction'));
 assert(reports(await actualLint("const q=(pool)=>pool.query('SELECT 1');void q;",'lib/server/node/webhook-events.ts'),'raw-sql-location'));
});

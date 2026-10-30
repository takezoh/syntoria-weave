import {spawn,spawnSync} from 'node:child_process';
import {once} from 'node:events';
import {writeFile,chmod} from 'node:fs/promises';
import pg from 'pg';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createServer} from 'node:net';
import {migrate,grantRuntime} from '../../lib/adapters/postgres/migrations.ts';
const currentMigrations=join(process.cwd(),'db/postgres/migrations');
export async function postgresFixture({migrations=currentMigrations}={}){
 const directory=await mkdtemp(join(tmpdir(),'action-pg-'));
 const listener=createServer();await new Promise((resolve,reject)=>{listener.once('error',reject);listener.listen(0,'127.0.0.1',resolve);});
 const port=listener.address().port;await new Promise(resolve=>listener.close(resolve));
 const password=crypto.randomUUID();
 // Import binary locations only: the wrapper installs a process-exit hook that suppresses Node per-file summaries.
 const binaries=await (await import(new URL('./binary.js',import.meta.resolve('embedded-postgres')))).default();
 await chmod(binaries.initdb,0o755);await chmod(binaries.postgres,0o755);
 const passwordFile=join(directory,'password');await writeFile(passwordFile,password,{mode:0o600});
 const data=join(directory,'db');let processHandle;
 const cluster={async initialise(){const result=spawnSync(binaries.initdb,['-D',data,'-U','postgres','--auth=scram-sha-256','--pwfile='+passwordFile,'--locale=C'],{encoding:'utf8'});if(result.status!==0)throw new Error('PostgreSQL initialization failed: '+result.stderr);},async start(){
  processHandle=spawn(binaries.postgres,['-D',data,'-h','127.0.0.1','-p',String(port),'-k',directory],{env:{...process.env,LC_ALL:'C'},stdio:['ignore','ignore','pipe']});
  await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('PostgreSQL startup timed out.')),10000);processHandle.once('error',reject);processHandle.once('exit',()=>{clearTimeout(timer);reject(new Error('PostgreSQL exited before readiness.'));});processHandle.stderr.on('data',chunk=>{if(chunk.toString().includes('ready to accept connections')){clearTimeout(timer);resolve();}});});
 },async stop(){if(processHandle&&processHandle.exitCode===null&&processHandle.signalCode===null){const stopped=once(processHandle,'exit');processHandle.kill('SIGINT');await stopped;}}};
 let admin,pool,closing=false;
 const poolError=error=>{if(!(closing&&error.code==='57P01'))throw error;};
 try {
  await cluster.initialise();await cluster.start();
  admin=new pg.Pool({connectionString:`postgresql://postgres:${password}@127.0.0.1:${port}/postgres`,max:3});
  admin.on('error',poolError);
  await migrate(admin,migrations);
  await admin.query(`CREATE ROLE action_runtime LOGIN PASSWORD '${password}'`);
  // Runtime grants describe the current schema; a test starting from an earlier migration set grants after migrating forward.
  if(migrations===currentMigrations)await grantRuntime(admin,'action_runtime');
  const url=`postgresql://action_runtime:${password}@127.0.0.1:${port}/postgres`;
  pool=new pg.Pool({connectionString:url,max:5,connectionTimeoutMillis:3000});
  pool.on('error',poolError);
  return {admin,pool,url,async close(){closing=true;await pool.end();await admin.end();await cluster.stop();await rm(directory,{recursive:true,force:true});}};
 }catch(error){await pool?.end();await admin?.end();await cluster.stop().catch(()=>{});await rm(directory,{recursive:true,force:true});throw error;}
}

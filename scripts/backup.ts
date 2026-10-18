import {spawn} from 'node:child_process';
import {Transform,Readable} from 'node:stream';
import {createHash,randomUUID} from 'node:crypto';
import {createPool} from '../lib/adapters/postgres/pool';
import {transferTables,assertTransferPrivilege} from '../lib/adapters/postgres/transfer';
const connection=process.env.BACKUP_DATABASE_URL,bucket=process.env.BACKUP_BUCKET;
if(!connection||!bucket||!/^[a-z0-9][a-z0-9._-]+$/.test(bucket))throw new Error('Backup database and bucket are required.');
const pool=createPool(connection),client=await pool.connect();
let child:ReturnType<typeof spawn>|undefined;
try{
 await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
 // The exported snapshot must remain alive for the separately bounded dump job.
 await client.query("SET LOCAL idle_in_transaction_session_timeout='900000ms'");await assertTransferPrivilege(client);
 const locked=(await client.query('SELECT pg_try_advisory_xact_lock(7247027267111032::bigint) AS locked')).rows[0].locked;if(!locked)throw new Error('Backup already running.');
 const snapshot=(await client.query('SELECT pg_export_snapshot() AS snapshot')).rows[0].snapshot as string;
 const counts:Record<string,string>={};for(const table of transferTables)counts[table]=(await client.query('SELECT count(*) AS count FROM '+table)).rows[0].count;
 const uri=new URL(connection);const env:NodeJS.ProcessEnv={...process.env,PGHOST:uri.hostname,PGPORT:uri.port||'5432',PGUSER:decodeURIComponent(uri.username),PGPASSWORD:decodeURIComponent(uri.password),PGDATABASE:uri.pathname.slice(1),PGSSLMODE:'verify-full',PGSSLROOTCERT:'system'};
 delete env.BACKUP_DATABASE_URL;
 child=spawn('pg_dump',['--format=custom','--no-owner','--no-acl','--enable-row-security','--snapshot='+snapshot],{env,stdio:['ignore','pipe','pipe'],timeout:840_000});
 // Stderr may contain database details; consume without logging it.
 child.stderr?.resume();
 const exit=new Promise<void>((resolve,reject)=>{child!.once('error',()=>reject(new Error('Backup subprocess failed.')));child!.once('exit',code=>code===0?resolve():reject(new Error('Backup subprocess failed.')));});
 // Mark rejection handled while streaming; still await and propagate before publishing the manifest.
 void exit.catch(()=>{});
 const digest=createHash('sha256');let bytes=0;
 const stream=child.stdout!.pipe(new Transform({transform(chunk,_encoding,callback){digest.update(chunk);bytes+=chunk.length;callback(null,chunk);}}));
 const credentials=await fetch('http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token',{headers:{'Metadata-Flavor':'Google'},signal:AbortSignal.timeout(3000)});
 if(!credentials.ok)throw new Error('Backup identity unavailable.');
 const {access_token:token}=await credentials.json() as {access_token:string};
 const id=new Date().toISOString().replaceAll(':','-')+'-'+randomUUID(),name=id+'.dump';
 const url=(object:string)=>`https://storage.googleapis.com/upload/storage/v1/b/${bucket}/o?uploadType=media&ifGenerationMatch=0&name=${encodeURIComponent(object)}`;
 const uploaded=await fetch(url(name),{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/octet-stream'},body:Readable.toWeb(stream) as ReadableStream,duplex:'half',signal:AbortSignal.timeout(840_000)} as RequestInit&{duplex:'half'});
 if(!uploaded.ok)throw new Error('Backup upload failed.');await uploaded.body?.cancel();await exit;
 const manifest=await fetch(url(id+'.manifest.json'),{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({version:1,object:name,sha256:digest.digest('hex'),bytes,counts,created_at:new Date().toISOString()}),signal:AbortSignal.timeout(10_000)});
 if(!manifest.ok)throw new Error('Backup manifest upload failed.');await manifest.body?.cancel();await client.query('COMMIT');
 console.log(JSON.stringify({operation:'backup',status:'ok',bytes}));
}catch{
 child?.kill('SIGTERM');await client.query('ROLLBACK').catch(()=>{});console.error(JSON.stringify({operation:'backup',status:'failed'}));process.exitCode=1;
}finally{client.release();await pool.end();}

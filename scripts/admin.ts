import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {exportData,importData,transferDigest,type Transfer} from '../lib/adapters/postgres/transfer';
import {createPool} from '../lib/adapters/postgres/pool';
import {migrate,grantRuntime,grantExport} from '../lib/adapters/postgres/migrations';
import {createPostgresActionStore} from '../lib/adapters/postgres/action-store';
import {issuePrincipal} from '../lib/server/node/principal';
import {validateGraph} from '../lib/domain/core';
const args=process.argv.slice(2),command=args.shift();
const connection=process.env.ADMIN_DATABASE_URL;if(!connection)throw new Error('ADMIN_DATABASE_URL is required.');
const pool=createPool(connection,{local:process.env.LOCAL_DATABASE==='true'&&process.env.NODE_ENV!=='production'});
function exactStringRecord(value:unknown,keys:readonly string[]):value is Record<string,string>{
 if(typeof value!=='object'||value===null||Array.isArray(value))return false;
 const record=value as Record<string,unknown>;
 return Object.keys(record).length===keys.length&&keys.every(key=>Object.hasOwn(record,key)&&typeof record[key]==='string'&&record[key].length>0);
}
try{
 switch(command){
  case 'migrate':await migrate(pool,resolve('db/postgres/migrations'));break;
  case 'grant-export':if(args.length!==1)throw new Error('Expected export role.');await grantExport(pool,args[0]);break;
  case 'grant-runtime':if(args.length!==1)throw new Error('Expected role.');await grantRuntime(pool,args[0]);break;
  case 'map-subject':{
   const path=args[0];if(!path)throw new Error('Expected private JSON subject map.');
   const parsed:unknown=JSON.parse(await readFile(path,'utf8'));
   if(!Array.isArray(parsed)||!parsed.every(value=>exactStringRecord(value,['issuer','subject','user'])))throw new Error('Subject map entries must contain only nonempty issuer, subject and user fields.');
   const input=parsed as {issuer:string;subject:string;user:string}[];
   const client=await pool.connect();try{await client.query('BEGIN');for(const value of input){
    if(!value.issuer||!value.subject||!value.user)throw new Error('Invalid subject map.');
    const prior=(await client.query('SELECT user_id FROM identity.subjects WHERE issuer=$1 AND subject=$2',[value.issuer,value.subject])).rows[0];
    if(prior&&prior.user_id!==value.user)throw new Error('Refusing implicit user reassignment.');
    await client.query('INSERT INTO identity.subjects(issuer,subject,user_id) VALUES($1,$2,$3) ON CONFLICT(issuer,subject) DO NOTHING',[value.issuer,value.subject,value.user]);
   }await client.query('COMMIT');}catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}break;
  }
  case 'snapshot':{
   const [user,path]=args;if(!user||!path)throw new Error('Expected user and private output file.');
   const principal=issuePrincipal({user,issuer:'admin',subject:user,connectionId:'admin',clientId:'admin',scopes:['state:read']});
   const value=await createPostgresActionStore(pool,principal).readSnapshot();validateGraph(value);
   await writeFile(path,JSON.stringify(value),{mode:0o600,flag:'wx'});break;
  }
  case 'export':{
   const path=args[0];if(!path)throw new Error('Expected private export file.');const value=await exportData(pool);
   await writeFile(path,JSON.stringify(value),{mode:0o600,flag:'wx'});await writeFile(path+'.manifest.json',JSON.stringify({version:1,sha256:transferDigest(value),created_at:new Date().toISOString(),counts:Object.fromEntries(Object.entries(value.tables).map(([key,rows])=>[key,rows.length]))}),{mode:0o600,flag:'wx'});break;
  }
  case 'import':{
   const path=args[0];if(!path||process.env.CONFIRM_WRITE_FENCE!=='true')throw new Error('A confirmed environment write fence and transfer file are required.');
   const value=JSON.parse(await readFile(path,'utf8')) as Transfer,manifest=JSON.parse(await readFile(path+'.manifest.json','utf8')) as {sha256:string};await importData(pool,value,manifest.sha256);break;
  }
  case 'apply-revocations':{
   const path=args[0];if(!path||process.env.CONFIRM_WRITE_FENCE!=='true')throw new Error('A write fence and current private revocation manifest are required.');
   const parsed:unknown=JSON.parse(await readFile(path,'utf8'));
   if(!Array.isArray(parsed)||!parsed.every(value=>exactStringRecord(value,['issuer','subject'])))throw new Error('Subject revocation entries must contain only nonempty issuer and subject fields.');
   const entries=parsed as {issuer:string;subject:string}[];
   const client=await pool.connect();try{await client.query('BEGIN');await client.query('DELETE FROM identity.sessions');await client.query('DELETE FROM identity.login_attempts');for(const entry of entries){
    await client.query('UPDATE identity.subjects SET enabled=false WHERE issuer=$1 AND subject=$2',[entry.issuer,entry.subject]);
   }await client.query('COMMIT');}catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}break;
  }
  default:throw new Error('Expected migrate, grant-runtime, grant-export, map-subject, snapshot, export, import or apply-revocations.');
 }
 console.log(JSON.stringify({status:'ok',operation:command}));
}catch(error){console.error(JSON.stringify({status:'failed',operation:command,code:(error as {code?:string}).code??'administrative_operation_failed'}));process.exitCode=1;}finally{await pool.end();}

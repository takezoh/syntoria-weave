import type {Pool} from 'pg';
import type {McpSubscriptions} from '../../server/node/mcp-subscriptions';
import {verifyPrincipal,type Principal} from '../../server/node/principal';

/** Database-backed subscriptions survive Cloud Run instance changes; no connection stays checked out while idle. */
export function createMcpSubscriptions(pool:Pool):McpSubscriptions {
 async function transaction<T>(principal:Principal,run:(client:import('pg').PoolClient)=>Promise<T>){
  verifyPrincipal(principal);const client=await pool.connect();
  try{await client.query('BEGIN');const value=await run(client);await client.query('COMMIT');return value;}catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
 }
 return {
  set:(p,resource,subscribed)=>transaction(p,async client=>{
   if(subscribed)await client.query('INSERT INTO state.mcp_subscriptions(user_id,connection_id,resource,expires_at) VALUES($1,$2,$3,now()+interval \'24 hours\') ON CONFLICT(user_id,connection_id,resource) DO UPDATE SET expires_at=excluded.expires_at',[p.user,p.connectionId,resource]);
   else await client.query('DELETE FROM state.mcp_subscriptions WHERE user_id=$1 AND connection_id=$2 AND resource=$3',[p.user,p.connectionId,resource]);
  }),
  list:p=>transaction(p,async client=>(await client.query('SELECT resource FROM state.mcp_subscriptions WHERE user_id=$1 AND connection_id=$2 AND expires_at>now() ORDER BY resource',[p.user,p.connectionId])).rows.map(row=>String(row.resource))),
 };
}

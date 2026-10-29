import type {Pool} from 'pg';
import type {McpSubscriptions} from '../../server/node/mcp-subscriptions';
import {verifyPrincipal,type Principal} from '../../server/node/principal';

/** Database-backed subscriptions survive Cloud Run instance changes; no connection stays checked out while idle. */
export function createMcpSubscriptions(pool:Pool):McpSubscriptions {
 async function transaction<T>(principal:Principal,run:(client:import('pg').PoolClient)=>Promise<T>){
  const p=verifyPrincipal(principal),client=await pool.connect();
  try{await client.query('BEGIN');await client.query("SELECT set_config('app.user_id',$1,true)",[p.user]);const value=await run(client);await client.query('COMMIT');return value;}catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
 }
 return {
  set:(p,subscribed)=>transaction(p,async client=>{
   if(subscribed)await client.query('INSERT INTO state.mcp_subscriptions(user_id,connection_id,expires_at) VALUES($1,$2,now()+interval \'24 hours\') ON CONFLICT(user_id,connection_id) DO UPDATE SET expires_at=excluded.expires_at',[p.user,p.connectionId]);
   else await client.query('DELETE FROM state.mcp_subscriptions WHERE user_id=$1 AND connection_id=$2',[p.user,p.connectionId]);
  }),
  has:p=>transaction(p,async client=>Boolean((await client.query('SELECT 1 FROM state.mcp_subscriptions WHERE user_id=$1 AND connection_id=$2 AND expires_at>now()',[p.user,p.connectionId])).rowCount)),
 };
}

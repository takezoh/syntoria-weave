import type {Pool,PoolClient} from 'pg';
import {fail} from '../../domain/core';
export type IdentityBinding=Readonly<{issuer:string;subject:string;clientId:string}>;
export type LoginAttempt=Readonly<{state_hash:string;binding_hash:string;verifier:string;nonce:string;return_to:string;channel:string}>;
export function createIdentityStore(pool:Pool) {
 async function grant(binding:IdentityBinding,client:Pool|PoolClient=pool){
  const row=(await client.query('SELECT s.user_id,g.scopes FROM identity.subjects s JOIN identity.client_grants g USING(issuer,subject) WHERE s.issuer=$1 AND s.subject=$2 AND g.client_id=$3 AND s.enabled AND g.enabled',[binding.issuer,binding.subject,binding.clientId])).rows[0];
  if(!row)fail('forbidden','This identity or client is not authorized.',403);
  return {user:String(row.user_id),scopes:row.scopes as string[]};
 }
 return {
  grant,
  async session(hash:string){
   const row=(await pool.query("SELECT issuer,subject,client_id FROM identity.sessions WHERE token_hash=$1 AND expires_at>now() AND last_activity>now()-interval '30 minutes'",[hash])).rows[0];
   if(!row)return null;
   await pool.query("UPDATE identity.sessions SET last_activity=now() WHERE token_hash=$1 AND last_activity<now()-interval '1 minute'",[hash]);
   return {issuer:String(row.issuer),subject:String(row.subject),clientId:String(row.client_id)};
  },
  async saveSession(hash:string,binding:IdentityBinding){await pool.query("INSERT INTO identity.sessions(token_hash,issuer,subject,client_id,expires_at) VALUES($1,$2,$3,$4,now()+interval '8 hours')",[hash,binding.issuer,binding.subject,binding.clientId]);},
  async deleteSession(hash:string){await pool.query('DELETE FROM identity.sessions WHERE token_hash=$1',[hash]);},
  async saveLogin(value:LoginAttempt){
   await pool.query("DELETE FROM identity.login_attempts WHERE state_hash IN (SELECT state_hash FROM identity.login_attempts WHERE expires_at<now() LIMIT 100)");
   await pool.query("DELETE FROM identity.sessions WHERE token_hash IN (SELECT token_hash FROM identity.sessions WHERE expires_at<now() OR last_activity<now()-interval '30 minutes' LIMIT 100)");
   await pool.query("INSERT INTO identity.login_attempts(state_hash,binding_hash,verifier,nonce,return_to,channel,expires_at) VALUES($1,$2,$3,$4,$5,$6,now()+interval '10 minutes')",[value.state_hash,value.binding_hash,value.verifier,value.nonce,value.return_to,value.channel]);
  },
  async consumeLogin(hash:string,bindingHash:string):Promise<LoginAttempt|null>{
   return (await pool.query('DELETE FROM identity.login_attempts WHERE state_hash=$1 AND binding_hash=$2 AND expires_at>now() RETURNING *',[hash,bindingHash])).rows[0]??null;
  }
 };
}
export type IdentityStore=ReturnType<typeof createIdentityStore>;

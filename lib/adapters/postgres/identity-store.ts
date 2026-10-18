import type {Pool,PoolClient} from 'pg';
import {fail} from '../../domain/core';

export type IdentityBinding=Readonly<{issuer:string;subject:string;clientId:string}>;

/** Resolve only an explicitly enabled subject and resource-client grant. */
export function createIdentityStore(pool:Pool) {
 async function grant(binding:IdentityBinding,client:Pool|PoolClient=pool){
  const row=(await client.query('SELECT s.user_id,g.scopes FROM identity.subjects s JOIN identity.client_grants g USING(issuer,subject) WHERE s.issuer=$1 AND s.subject=$2 AND g.client_id=$3 AND s.enabled AND g.enabled',[binding.issuer,binding.subject,binding.clientId])).rows[0];
  if(!row)fail('forbidden','This identity or client is not authorized.',403);
  return {user:String(row.user_id),scopes:row.scopes as string[]};
 }
 return {grant};
}

export type IdentityStore=ReturnType<typeof createIdentityStore>;

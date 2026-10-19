import type {Pool,PoolClient} from 'pg';
import {fail} from '../../domain/core';

export type IdentityBinding=Readonly<{issuer:string;subject:string}>;

/** Resolve only an explicitly enabled issuer and subject mapping. */
export function createIdentityStore(pool:Pool) {
 async function resolveSubject(binding:IdentityBinding,client:Pool|PoolClient=pool){
  const row=(await client.query('SELECT user_id FROM identity.subjects WHERE issuer=$1 AND subject=$2 AND enabled',[binding.issuer,binding.subject])).rows[0];
  if(!row)fail('forbidden','This identity is not authorized.',403);
  return {user:String(row.user_id)};
 }
 return {resolveSubject};
}

export type IdentityStore=ReturnType<typeof createIdentityStore>;

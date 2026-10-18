import pg from 'pg';
export function createPool(connectionString:string,{max=5,local=false}:{max?:number;local?:boolean}={}) {
 const url=new URL(connectionString);
 if(!['postgres:','postgresql:'].includes(url.protocol))throw new Error('A PostgreSQL URL is required.');
 if(!local&&url.searchParams.get('sslmode')==='disable')throw new Error('TLS is required.');
 // Explicit TLS options must not be replaced by permissive URL sslmode options.
 for(const key of ['sslmode','sslcert','sslkey','sslrootcert'])url.searchParams.delete(key);
 const pool=new pg.Pool({connectionString:url.href,max,idleTimeoutMillis:30_000,connectionTimeoutMillis:3000,
  ssl:local?false:{rejectUnauthorized:true},options:'-c statement_timeout=10000 -c lock_timeout=3000 -c idle_in_transaction_session_timeout=5000'});
 pool.on('error',()=>{console.error('database connection unavailable');});
 return pool;
}

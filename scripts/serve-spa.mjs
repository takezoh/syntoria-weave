import http from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import {resolve,sep} from 'node:path';

const preferred=resolve('.local/spa'),fallback=resolve('dist/spa');
let root=preferred;
try{await stat(root);}catch{root=fallback;}
const port=Number(process.env.PORT??5173);
if(!Number.isInteger(port)||port<1||port>65535)throw new Error('Invalid PORT.');
const types=new Map([['.html','text/html; charset=utf-8'],['.js','text/javascript; charset=utf-8'],['.mjs','text/javascript; charset=utf-8'],['.css','text/css; charset=utf-8'],['.json','application/json; charset=utf-8'],['.svg','image/svg+xml'],['.png','image/png'],['.ico','image/x-icon']]);
const server=http.createServer(async(req,res)=>{
 try{
  const host=(req.headers.host??'').split(':',1)[0]?.replace(/^\[|\]$/g,'');
  if(!['localhost','127.0.0.1','::1'].includes(host)){res.writeHead(403,{'cache-control':'no-store'}).end();return;}
  const pathname=new URL(req.url??'/',`http://${req.headers.host??'localhost'}`).pathname;
  const relative=decodeURIComponent(pathname==='/'?'/index.html':pathname);
  const path=resolve(root,'.'+relative);
  if(path!==root&&!path.startsWith(root+sep)){res.writeHead(404,{'cache-control':'no-store'}).end();return;}
  if(req.method!=='GET'&&req.method!=='HEAD'){res.writeHead(405,{allow:'GET, HEAD','cache-control':'no-store'}).end();return;}
  const body=await readFile(path),type=types.get(path.slice(path.lastIndexOf('.')))??'application/octet-stream';
  const headers={'content-type':type,'x-content-type-options':'nosniff','cache-control':path.endsWith('runtime-config.json')?'no-store':path.endsWith('.html')?'no-cache':'public, max-age=31536000, immutable'};
  res.writeHead(200,headers);res.end(req.method==='HEAD'?undefined:body);
 }catch(error){
  if(error?.code==='ENOENT'){res.writeHead(404,{'cache-control':'no-store'}).end();return;}
  res.writeHead(500,{'cache-control':'no-store'}).end();
 }
});
server.listen(port,'127.0.0.1',()=>process.stdout.write('Static SPA preview listening on loopback port '+port+'; API calls go directly to the configured API origin.\n'));
for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>server.close(()=>process.exit(0)));

import https from 'node:https';

const port=Number(process.env.GATE_TEST_LOOPBACK_PORT);
if(Number.isInteger(port)&&port>0){
 const nativeFetch=globalThis.fetch;
 globalThis.fetch=async(input,init={})=>{
  const target=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url);
  if(target.hostname!=='gate.example.localhost'||Number(target.port)!==port)return nativeFetch(input,init);
  return new Promise((resolve,reject)=>{
   const headers=new Headers(init.headers??(input instanceof Request?input.headers:undefined));
   const request=https.request({hostname:'127.0.0.1',port,path:target.pathname+target.search,method:init.method??(input instanceof Request?input.method:'GET'),headers:Object.fromEntries(headers),servername:target.hostname,signal:init.signal},response=>{
    const chunks=[];response.on('data',chunk=>chunks.push(chunk));response.on('end',()=>{
     const result=new Response(Buffer.concat(chunks),{status:response.statusCode,headers:response.headers});
     Object.defineProperty(result,'url',{value:target.href});resolve(result);
    });
   });
   request.on('error',reject);request.end(init.body??(input instanceof Request?input.body:undefined));
  });
 };
}

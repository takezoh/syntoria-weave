/** Callback URLs and connected addresses must be public HTTPS destinations; every other form is rejected. */

const v4=(text:string)=>{
 const parts=text.split('.');
 if(parts.length!==4||!parts.every(part=>/^(?:0|[1-9]\d{0,2})$/.test(part)&&Number(part)<256))return null;
 return parts.map(Number);
};

/** The eight 16-bit groups of an IPv6 address, including an embedded dotted IPv4 tail; null when malformed. */
function v6(text:string){
 const address=text.toLowerCase().split('%',1)[0]!;
 if(!/^[0-9a-f:.]+$/.test(address)||(address.match(/::/g)??[]).length>1)return null;
 let tail:number[]=[];let body=address;
 const dotted=/^(.*:)(\d+\.\d+\.\d+\.\d+)$/.exec(address);
 if(dotted){const four=v4(dotted[2]!);if(!four)return null;tail=[(four[0]!<<8)|four[1]!,(four[2]!<<8)|four[3]!];body=dotted[1]!.endsWith('::')?dotted[1]!:dotted[1]!.slice(0,-1);}
 const [head,rest]=body.includes('::')?body.split('::') as [string,string]:[body,undefined];
 const parse=(value:string)=>value===''?[]:value.split(':').map(group=>/^[0-9a-f]{1,4}$/.test(group)?parseInt(group,16):NaN);
 const left=parse(head),right=rest===undefined?[]:parse(rest);
 if([...left,...right].some(Number.isNaN))return null;
 const missing=8-left.length-right.length-tail.length;
 if(rest===undefined?missing!==0:missing<1)return null;
 return [...left,...Array(rest===undefined?0:missing).fill(0),...right,...tail] as number[];
}

const inV4=(address:readonly number[],prefix:readonly number[],bits:number)=>{
 const value=(address[0]!<<24>>>0)+(address[1]!<<16)+(address[2]!<<8)+address[3]!,base=(prefix[0]!<<24>>>0)+(prefix[1]!<<16)+(prefix[2]!<<8)+prefix[3]!;
 return bits===0||(value>>>(32-bits))===(base>>>(32-bits));
};
const V4_NONPUBLIC:readonly [readonly number[],number][]=[
 [[0,0,0,0],8],[[10,0,0,0],8],[[100,64,0,0],10],[[127,0,0,0],8],[[169,254,0,0],16],[[172,16,0,0],12],[[192,0,0,0],24],[[192,0,2,0],24],
 [[192,88,99,0],24],[[192,168,0,0],16],[[198,18,0,0],15],[[198,51,100,0],24],[[203,0,113,0],24],[[224,0,0,0],4],[[240,0,0,0],4],
];
const publicV4=(address:readonly number[])=>!V4_NONPUBLIC.some(([prefix,bits])=>inV4(address,prefix,bits));

/** True only for a globally routable unicast address; mapped, translated and special-purpose ranges are not public. */
export function isPublicAddress(text:string):boolean {
 const four=v4(text);if(four)return publicV4(four);
 const six=v6(text);if(!six)return false;
 const [a,b]=six as [number,number];
 if(six.slice(0,6).every(group=>group===0))return false;
 if(six.slice(0,5).every(group=>group===0)&&six[5]===0xffff)return false;
 if(a===0x64&&b===0xff9b)return false;
 if((a&0xe000)!==0x2000)return false;
 if(a===0x2001&&b<0x200)return false;
 if(a===0x2001&&b===0xdb8)return false;
 if(a===0x2002)return false;
 if(a===0x3fff&&b<0x1000)return false;
 return true;
}

/** The literal host of a URL hostname, without IPv6 brackets. */
export const literalHost=(hostname:string)=>hostname.startsWith('[')&&hostname.endsWith(']')?hostname.slice(1,-1):hostname;
export const isAddressLiteral=(host:string)=>v4(host)!==null||(host.includes(':')&&v6(host)!==null);

/** WHATWG serialization of a public HTTPS callback, or null when the URL may not receive deliveries. */
export function normalizeCallbackUrl(value:unknown):string|null {
 if(typeof value!=='string'||value.length>2048||value.includes('#'))return null;
 let url:URL;try{url=new URL(value);}catch{return null;}
 if(url.protocol!=='https:'||url.username||url.password||url.hash)return null;
 const host=literalHost(url.hostname);
 if(isAddressLiteral(host))return isPublicAddress(host)?url.href:null;
 if(!host.includes('.')||host==='localhost'||/\.(?:localhost|local|internal|home\.arpa|localdomain)$/.test(host)||host.endsWith('.'))return null;
 return url.href;
}

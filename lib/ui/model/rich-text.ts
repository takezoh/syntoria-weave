/** Read-only rendering structure for saved text. Parsing never rewrites the source; raw HTML stays text. */
export type RichInline=
 |{kind:'text';text:string}
 |{kind:'code';text:string}
 |{kind:'strong'|'emphasis'|'strike';children:RichInline[]}
 |{kind:'link';href:string;children:RichInline[]}
 |{kind:'break'};
export interface RichListItem {checked:boolean|null;blocks:RichBlock[]}
export type RichBlock=
 |{kind:'paragraph';children:RichInline[]}
 |{kind:'heading';level:number;children:RichInline[]}
 |{kind:'list';ordered:boolean;start:number;items:RichListItem[]}
 |{kind:'quote';blocks:RichBlock[]}
 |{kind:'code';text:string}
 |{kind:'rule'};

const maxDepth=12;
const asciiPunctuation=/[!-/:-@[-`{-~]/;
const bareUrl=/(?:https?:\/\/|www\.)[A-Za-z0-9\-._~:/?#[\]@!$&'()*+,;=%]+/iy;
const angleUrl=/<((?:https?:\/\/|mailto:)[^\s<>]+)>/iy;
const angleEmail=/<([A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+)>/y;

/** Only web and mail destinations become links; other schemes and relative paths remain text. */
export function safeHref(value:string):string|null {
 const href=value.trim();
 if(!href||href.length>2048||/[\u0000- \u007f-\u009f]/.test(href))return null;
 return /^https?:\/\/[^/?#]+/i.test(href)||/^mailto:[^\s/@]+@[^\s/@]+$/i.test(href)?href:null;
}

const isSpace=(ch:string|undefined)=>ch===undefined||/\s/.test(ch);
const isWord=(ch:string|undefined)=>ch!==undefined&&/[\p{L}\p{N}]/u.test(ch);
function runLength(text:string,index:number,ch:string){let end=index;while(text[end]===ch)end++;return end-index;}

/** Failed closer searches are remembered, so repeated unmatched delimiters stay linear. */
interface InlineScan {text:string;depth:number;links:boolean;noClose:Map<string,number>}
function codeSpanEnd(scan:InlineScan,start:number,run:number):number {
 const key='`'+run;if(start>=(scan.noClose.get(key)??Infinity))return -1;
 for(let index=start;index<scan.text.length;){
  if(scan.text[index]!=='`'){index++;continue;}
  const length=runLength(scan.text,index,'`');if(length===run)return index;index+=length;
 }
 scan.noClose.set(key,Math.min(scan.noClose.get(key)??Infinity,start));return -1;
}
function delimiterEnd(scan:InlineScan,start:number,ch:string,run:number):number {
 const key=ch+run,text=scan.text;if(start>=(scan.noClose.get(key)??Infinity))return -1;
 for(let index=start;index<text.length;){
  const current=text[index];
  if(current==='\\'){index+=2;continue;}
  if(current==='`'){const length=runLength(text,index,'`'),end=codeSpanEnd(scan,index+length,length);index=end<0?index+length:end+length;continue;}
  if(current!==ch){index++;continue;}
  const length=runLength(text,index,ch);
  if(length===run&&index>start&&!isSpace(text[index-1])&&(ch!=='_'||!isWord(text[index+length])))return index;
  index+=length;
 }
 scan.noClose.set(key,Math.min(scan.noClose.get(key)??Infinity,start));return -1;
}
function linkAt(scan:InlineScan,start:number):{end:number;label:string;href:string|null}|null {
 const text=scan.text;let close=-1;
 for(let index=start+1;index<text.length;index++){const ch=text[index];if(ch==='\\'){index++;continue;}if(ch==='[')return null;if(ch===']'){close=index;break;}}
 if(close<0||text[close+1]!=='(')return null;
 let index=close+2;while(text[index]===' '||text[index]==='\t')index++;
 let destination:string;
 if(text[index]==='<'){const end=text.indexOf('>',index+1);if(end<0||text.slice(index+1,end).includes('\n'))return null;destination=text.slice(index+1,end);index=end+1;}
 else{const from=index;let depth=0;while(index<text.length){const ch=text[index];if(isSpace(ch))break;if(ch==='\\'){index+=2;continue;}if(ch==='(')depth++;else if(ch===')'){if(!depth)break;depth--;}index++;}destination=text.slice(from,index);}
 while(text[index]===' '||text[index]==='\t')index++;
 const quote=text[index];
 if(quote==='"'||quote==='\''||quote==='('){const end=text.indexOf(quote==='('?')':quote,index+1);if(end<0)return null;index=end+1;while(text[index]===' '||text[index]==='\t')index++;}
 if(text[index]!==')')return null;
 return {end:index+1,label:text.slice(start+1,close),href:safeHref(destination)};
}
function trimBareUrl(value:string):string {
 let url=value;
 for(;;){
  const last=url[url.length-1];
  if('?!.,:*_~\'"'.includes(last)){url=url.slice(0,-1);continue;}
  if(last===')'&&url.split(')').length>url.split('(').length){url=url.slice(0,-1);continue;}
  if(last===']'&&url.split(']').length>url.split('[').length){url=url.slice(0,-1);continue;}
  return url;
 }
}
function inlineNodes(text:string,depth:number,links:boolean):RichInline[] {
 const scan:InlineScan={text,depth,links,noClose:new Map()},nodes:RichInline[]=[];let buffer='';
 const flush=()=>{if(buffer){nodes.push({kind:'text',text:buffer});buffer='';}};
 const push=(node:RichInline)=>{flush();nodes.push(node);};
 const nested=depth<maxDepth;
 for(let index=0;index<text.length;){
  const ch=text[index];
  if(ch==='\\'&&asciiPunctuation.test(text[index+1]??'')){buffer+=text[index+1];index+=2;continue;}
  if(ch==='\n'){push({kind:'break'});index++;continue;}
  if(ch==='`'){
   const run=runLength(text,index,'`'),end=codeSpanEnd(scan,index+run,run);
   if(end>=0){let code=text.slice(index+run,end).replace(/\n/g,' ');if(code.length>2&&code.startsWith(' ')&&code.endsWith(' ')&&code.trim())code=code.slice(1,-1);push({kind:'code',text:code});index=end+run;continue;}
   buffer+=text.slice(index,index+run);index+=run;continue;
  }
  if(links&&nested&&ch==='['){
   const link=linkAt(scan,index);
   if(link?.href){push({kind:'link',href:link.href,children:inlineNodes(link.label,depth+1,false)});index=link.end;continue;}
   if(link){buffer+=text.slice(index,link.end);index=link.end;continue;}
  }
  if(links&&ch==='<'){
   angleUrl.lastIndex=index;angleEmail.lastIndex=index;
   const url=text.match(angleUrl),email=url?null:text.match(angleEmail),href=url?safeHref(url[1]):email?safeHref('mailto:'+email[1]):null;
   if(href){const match=(url||email)!;push({kind:'link',href,children:[{kind:'text',text:match[1]}]});index+=match[0].length;continue;}
  }
  if(links&&/[hHwW]/.test(ch)&&!/[A-Za-z0-9]/.test(text[index-1]??'')){
   bareUrl.lastIndex=index;const match=text.match(bareUrl);
   if(match){
    const value=trimBareUrl(match[0]),href=/^(?:https?:\/\/|www\.)$/i.test(value)?null:safeHref(/^www\./i.test(value)?'https://'+value:value);
    if(href){push({kind:'link',href,children:[{kind:'text',text:value}]});index+=value.length;continue;}
    buffer+=value||ch;index+=value.length||1;continue;
   }
  }
  if(ch==='*'||ch==='_'||ch==='~'){
   const run=runLength(text,index,ch),opening=!isSpace(text[index+run])&&(ch!=='_'||!isWord(text[index-1]));
   const supported=ch==='~'?run===2:run<=3;
   if(nested&&opening&&supported){
    const end=delimiterEnd(scan,index+run,ch,run);
    if(end>=0){
     const children=inlineNodes(text.slice(index+run,end),depth+1,links);
     push(ch==='~'?{kind:'strike',children}:run===1?{kind:'emphasis',children}:run===2?{kind:'strong',children}:{kind:'strong',children:[{kind:'emphasis',children}]});
     index=end+run;continue;
    }
   }
   buffer+=text.slice(index,index+run);index+=run;continue;
  }
  buffer+=ch;index++;
 }
 flush();return nodes;
}

function indentOf(line:string):number {let width=0;for(const ch of line){if(ch===' ')width++;else if(ch==='\t')width+=4-width%4;else break;}return width;}
function stripIndent(line:string,columns:number):string {let width=0,index=0;while(index<line.length&&width<columns){const ch=line[index];if(ch===' ')width++;else if(ch==='\t')width+=4-width%4;else break;index++;}return line.slice(index);}
const isBlank=(line:string)=>!line.trim();
const fencePattern=/^ {0,3}(`{3,}|~{3,})(.*)$/;
const headingPattern=/^ {0,3}(#{1,6})(?:[ \t]+(.*?))?(?:[ \t]+#+)?[ \t]*$/;
const rulePattern=/^ {0,3}(?:(?:\*[ \t]*){3,}|(?:-[ \t]*){3,}|(?:_[ \t]*){3,})$/;
const quotePattern=/^ {0,3}>[ \t]?(.*)$/;
const itemPattern=/^([ \t]*)([-*+]|\d{1,9}[.)])(?:([ \t]+)(.*)|$)/;
interface ListMarker {indent:number;ordered:boolean;start:number;contentIndent:number;content:string}
function listMarker(line:string):ListMarker|null {
 if(rulePattern.test(line))return null;
 const match=line.match(itemPattern);if(!match)return null;
 const indent=indentOf(match[1]),marker=match[2],spacing=match[3]?indentOf(' '.repeat(indent+marker.length)+match[3])-indent-marker.length:1;
 const ordered=/^\d/.test(marker);
 return {indent,ordered,start:ordered?Number.parseInt(marker,10):1,contentIndent:indent+marker.length+(spacing>4?1:spacing),content:match[4]??''};
}
function fenceOpening(line:string){const match=line.match(fencePattern);return match&&!(match[1][0]==='`'&&match[2].includes('`'))?match:null;}
function startsBlock(line:string){return Boolean(fenceOpening(line)||headingPattern.test(line)||rulePattern.test(line)||quotePattern.test(line)||listMarker(line)?.content.trim());}

function parseList(lines:readonly string[],start:number,depth:number):{block:RichBlock;end:number} {
 const first=listMarker(lines[start])!,base=first.indent,items:RichListItem[]=[];let index=start;
 const sibling=(marker:ListMarker|null)=>Boolean(marker&&marker.ordered===first.ordered&&marker.indent>=base&&marker.indent<=base+1);
 while(index<lines.length){
  const marker=listMarker(lines[index]);if(!marker||!sibling(marker))break;
  const body=[marker.content];index++;
  while(index<lines.length){
   const line=lines[index];
   if(isBlank(line)){
    let next=index+1;while(next<lines.length&&isBlank(lines[next]))next++;
    if(next<lines.length&&sibling(listMarker(lines[next]))){index=next;break;}
    if(next<lines.length&&indentOf(lines[next])>base){for(;index<next;index++)body.push('');continue;}
    break;
   }
   const nestedMarker=listMarker(line);
   if(nestedMarker&&nestedMarker.indent<=base+1)break;
   const indent=indentOf(line);
   if(indent>base){body.push(stripIndent(line,Math.min(indent,marker.contentIndent)));index++;continue;}
   if(startsBlock(line))break;
   body.push(line.trim());index++;
  }
  const task=body[0].match(/^\[([ xX])\](?:[ \t]+|$)/);
  if(task)body[0]=body[0].slice(task[0].length);
  items.push({checked:task?task[1]!==' ':null,blocks:parseBlocks(body,depth+1)});
 }
 return {block:{kind:'list',ordered:first.ordered,start:first.start,items},end:index};
}
function parseBlocks(lines:readonly string[],depth:number):RichBlock[] {
 if(depth>=maxDepth){const text=lines.map(line=>line.trim()).join('\n').trim();return text?[{kind:'paragraph',children:[{kind:'text',text}]}]:[];}
 const blocks:RichBlock[]=[];let paragraph:string[]=[];
 const flush=()=>{if(paragraph.length){blocks.push({kind:'paragraph',children:inlineNodes(paragraph.join('\n'),depth,true)});paragraph=[];}};
 for(let index=0;index<lines.length;){
  const line=lines[index];
  if(isBlank(line)){flush();index++;continue;}
  const fence=fenceOpening(line);
  if(fence){
   flush();const marker=fence[1],indent=indentOf(line),closing=new RegExp('^ {0,3}'+(marker[0]==='`'?'`':'~')+'{'+marker.length+',}[ \\t]*$'),body:string[]=[];index++;
   while(index<lines.length&&!closing.test(lines[index])){body.push(stripIndent(lines[index],indent));index++;}
   index++;blocks.push({kind:'code',text:body.join('\n')});continue;
  }
  const heading=line.match(headingPattern);
  if(heading){flush();blocks.push({kind:'heading',level:heading[1].length,children:inlineNodes(heading[2]??'',depth,true)});index++;continue;}
  if(rulePattern.test(line)){flush();blocks.push({kind:'rule'});index++;continue;}
  if(quotePattern.test(line)){
   flush();const body:string[]=[];
   while(index<lines.length&&quotePattern.test(lines[index])){body.push(lines[index].match(quotePattern)![1]);index++;}
   blocks.push({kind:'quote',blocks:parseBlocks(body,depth+1)});continue;
  }
  const marker=listMarker(line);
  if(marker&&(!paragraph.length||marker.content.trim())){flush();const list=parseList(lines,index,depth);blocks.push(list.block);index=list.end;continue;}
  paragraph.push(line.trim());index++;
 }
 flush();return blocks;
}

/** Single-line text such as a Title: links, code spans and emphasis. */
export function parseRichInline(source:string):RichInline[] {return inlineNodes(source.replace(/\r\n?/g,'\n'),0,true);}
/** Multi-line text such as Notes: a Markdown subset whose single line breaks are kept. */
export function parseRichBlocks(source:string):RichBlock[] {return parseBlocks(source.replace(/\r\n?/g,'\n').split('\n'),0);}

/** Keyed variant for several texts rendered together, such as collaboration cards; it retains at most `limit` sources of each kind. */
export function createRichTextCache(limit=256){
 const inline=new Map<string,RichInline[]>(),blocks=new Map<string,RichBlock[]>();
 const read=<T>(cache:Map<string,T>,source:string,parse:(source:string)=>T):T=>{let value=cache.get(source);if(value===undefined){value=parse(source);if(cache.size>=limit)cache.delete(cache.keys().next().value as string);cache.set(source,value);}return value;};
 return {inline:(source:string)=>read(inline,source,parseRichInline),blocks:(source:string)=>read(blocks,source,parseRichBlocks)};
}

/** Repeated renders of unchanged text reuse the same structure, so components can retain their nodes. */
export function createRichTextModel(){
 let inlineSource:string|null=null,inlineResult:RichInline[]=[],blockSource:string|null=null,blockResult:RichBlock[]=[];
 return {
  safeHref,
  inline(source:string):RichInline[]{if(source!==inlineSource){inlineSource=source;inlineResult=parseRichInline(source);}return inlineResult;},
  blocks(source:string):RichBlock[]{if(source!==blockSource){blockSource=source;blockResult=parseRichBlocks(source);}return blockResult;},
 };
}

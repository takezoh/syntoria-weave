import test from 'node:test';
import assert from 'node:assert/strict';
import {createRichTextModel,parseRichBlocks,parseRichInline,safeHref} from '../../lib/ui/model/rich-text.ts';

const text=value=>({kind:'text',text:value});
const link=(href,label=href)=>({kind:'link',href,children:[text(label)]});
const paragraph=(...children)=>({kind:'paragraph',children});

test('inline text renders links, code spans and emphasis while raw HTML stays text',()=>{
 assert.deepEqual(parseRichInline('Read [the spec](https://example.com/spec "Spec") and `a*b*` **now** _soon_ ~~old~~ <b>raw</b>'),[
  text('Read '),link('https://example.com/spec','the spec'),text(' and '),{kind:'code',text:'a*b*'},text(' '),
  {kind:'strong',children:[text('now')]},text(' '),{kind:'emphasis',children:[text('soon')]},text(' '),{kind:'strike',children:[text('old')]},text(' <b>raw</b>'),
 ]);
 assert.deepEqual(parseRichInline('snake_case_name 5 * 3 * 2 \\*literal\\* ***both***'),[
  text('snake_case_name 5 * 3 * 2 *literal* '),{kind:'strong',children:[{kind:'emphasis',children:[text('both')]}]},
 ]);
});

test('bare and angle URLs become links without trailing punctuation or adjacent Japanese text',()=>{
 assert.deepEqual(parseRichInline('See https://example.com/a_(b). 詳細はhttps://example.jp/docs。 www.example.org/x, <https://example.com/パス> <me@example.com>'),[
  text('See '),link('https://example.com/a_(b)'),text('. 詳細は'),link('https://example.jp/docs'),text('。 '),
  link('https://www.example.org/x','www.example.org/x'),text(', '),link('https://example.com/パス'),text(' '),link('mailto:me@example.com','me@example.com'),
 ]);
 assert.deepEqual(parseRichInline('**https://example.com**'),[{kind:'strong',children:[link('https://example.com')]}]);
 assert.deepEqual(parseRichInline('xhttps://example.com https:// www.'),[text('xhttps://example.com https:// www.')]);
});

test('unsafe or relative link destinations are kept as literal source text',()=>{
 for(const source of ['[run](javascript:alert(1))','[data](data:text/html,x)','[file](docs/readme.md)','[ftp](ftp://example.com)'])
  assert.deepEqual(parseRichInline(source),[text(source)]);
 assert.deepEqual(parseRichInline('<javascript:alert(1)>'),[text('<javascript:alert(1)>')]);
 assert.equal(safeHref('https://example.com/a?b#c'),'https://example.com/a?b#c');
 assert.equal(safeHref('mailto:me@example.com?subject=Hi'),'mailto:me@example.com?subject=Hi');
 for(const value of ['javascript:alert(1)','JAVASCRIPT:x','data:text/html,x','https://','https://exa mple.com','https://example.com/\u0000','/relative','https://'+'a'.repeat(2048)])
  assert.equal(safeHref(value),null);
});

test('blocks keep single line breaks and structure lists, headings, quotes, code and rules',()=>{
 const source='# Plan\nfirst line\nsecond line\n\n- [ ] draft\n- [x] review\n  - nested item\n    continued\n\n3. three\n4. four\n\n> quoted **text**\n> more\n\n```js\nconst a = `x`;\n  indented\n```\n***\n#hashtag stays text';
 assert.deepEqual(parseRichBlocks(source),[
  {kind:'heading',level:1,children:[text('Plan')]},
  paragraph(text('first line'),{kind:'break'},text('second line')),
  {kind:'list',ordered:false,start:1,items:[
   {checked:false,blocks:[paragraph(text('draft'))]},
   {checked:true,blocks:[paragraph(text('review')),{kind:'list',ordered:false,start:1,items:[{checked:null,blocks:[paragraph(text('nested item'),{kind:'break'},text('continued'))]}]}]},
  ]},
  {kind:'list',ordered:true,start:3,items:[{checked:null,blocks:[paragraph(text('three'))]},{checked:null,blocks:[paragraph(text('four'))]}]},
  {kind:'quote',blocks:[paragraph(text('quoted '),{kind:'strong',children:[text('text')]},{kind:'break'},text('more'))]},
  {kind:'code',text:'const a = `x`;\n  indented'},
  {kind:'rule'},
  paragraph(text('#hashtag stays text')),
 ]);
});

test('loose lists stay one list and different markers or outdented text end it',()=>{
 assert.deepEqual(parseRichBlocks('- a\n\n- b\n1. c\nafter\n\nnext'),[
  {kind:'list',ordered:false,start:1,items:[{checked:null,blocks:[paragraph(text('a'))]},{checked:null,blocks:[paragraph(text('b'))]}]},
  {kind:'list',ordered:true,start:1,items:[{checked:null,blocks:[paragraph(text('c'),{kind:'break'},text('after'))]}]},
  paragraph(text('next')),
 ]);
 assert.deepEqual(parseRichBlocks('\r\n  \r\n'),[]);
 assert.deepEqual(parseRichBlocks('text\n-\nmore'),[paragraph(text('text'),{kind:'break'},text('-'),{kind:'break'},text('more'))]);
});

test('pathological delimiters and deep nesting stay bounded',()=>{
 const started=performance.now();
 for(const source of ['*a '.repeat(22000),'`a '.repeat(22000),'[a '.repeat(22000),'_a_ '.repeat(16000),'www.'.repeat(16000),'> '.repeat(30000),'- a\n'.repeat(16000),'  '.repeat(200).split('').map((_,i)=>' '.repeat(i)+'- x').join('\n')])assert.ok(Array.isArray(parseRichBlocks(source)));
 assert.ok(performance.now()-started<2000);
 let nested=parseRichBlocks('> '.repeat(40)+'deep');for(let depth=0;depth<40&&nested[0]?.kind==='quote';depth++)nested=nested[0].blocks;
 assert.equal(nested[0].kind,'paragraph');
});

test('rich text model reuses the structure for unchanged source text',()=>{
 const model=createRichTextModel(),first=model.blocks('- a'),inline=model.inline('Title');
 assert.equal(model.blocks('- a'),first);assert.equal(model.inline('Title'),inline);
 assert.notEqual(model.blocks('- b'),first);assert.deepEqual(model.blocks('- a'),first);
});

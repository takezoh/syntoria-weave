import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {JSDOM} from 'jsdom';

test('static SPA reserves browser safe areas outside the shared workspace iframe',async()=>{
 const html=await readFile('web/index.html','utf8');
 const dom=new JSDOM(html,{url:'https://app.example.test'});
 const {document}=dom.window;
 const viewport=document.querySelector('meta[name="viewport"]');
 assert.match(viewport?.content??'',/viewport-fit=cover/);
 assert.deepEqual(
  [...document.querySelectorAll('meta[name="theme-color"]')].map(meta=>[meta.getAttribute('media'),meta.getAttribute('content')]),
  [['(prefers-color-scheme: light)','#ffffff'],['(prefers-color-scheme: dark)','#19191c']],
 );

 const css=document.querySelector('style')?.textContent??'';
 assert.match(css,/body\s*\{[^}]*box-sizing:\s*border-box;[^}]*height:\s*100dvh;[^}]*padding:\s*env\(safe-area-inset-top\)\s+env\(safe-area-inset-right\)\s+env\(safe-area-inset-bottom\)\s+env\(safe-area-inset-left\);/s);
 assert.match(css,/:root\s*\{[^}]*background:\s*light-dark\(#fff,\s*#19191c\);/s);
 assert.match(css,/html,\s*body\s*\{[^}]*background:\s*light-dark\(#fff,\s*#19191c\);/s);
 assert.match(css,/#workspace\s*\{[^}]*flex:\s*1;[^}]*min-height:\s*0;/s);
 dom.window.close();
});

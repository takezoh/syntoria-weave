import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {JSDOM} from 'jsdom';

test('SPA bounds the iframe with safe-area padding and no overlapping clearance band',async()=>{
 const dom=new JSDOM(await readFile('web/index.html','utf8'));
 const d=dom.window.document,css=d.querySelector('style').textContent;
 assert.match(d.querySelector('meta[name="viewport"]').content,/viewport-fit=cover/);
 assert.equal(d.querySelector('#top-clearance-band'),null);
 assert.doesNotMatch(css,/shell-top-clearance/);
 assert.match(css,/html,\s*body\s*\{[^}]*height:\s*100%;[^}]*overflow:\s*hidden;/s);
 assert.match(css,/body\s*\{[^}]*box-sizing:\s*border-box;[^}]*height:\s*100dvh;[^}]*padding:\s*env\(safe-area-inset-top\)\s+env\(safe-area-inset-right\)\s+env\(safe-area-inset-bottom\)\s+env\(safe-area-inset-left\);/s);
 assert.match(css,/#workspace\s*\{[^}]*flex:\s*1;[^}]*min-height:\s*0;/s);
 dom.window.close();
});

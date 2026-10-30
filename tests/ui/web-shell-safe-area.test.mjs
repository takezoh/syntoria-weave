import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {JSDOM} from 'jsdom';

test('static SPA scopes explicit clearance and an opaque band to WebKit standalone or fullscreen portrait',async()=>{
 const html=await readFile('web/index.html','utf8');
 const dom=new JSDOM(html,{url:'https://app.example.test'});
 const {document}=dom.window;
 const viewport=document.querySelector('meta[name="viewport"]');
 assert.match(viewport?.content??'',/viewport-fit=cover/);
 assert.equal(document.querySelector('meta[name="layout-probe"]')?.content,'layout-probe-1');
 assert.deepEqual(
  [...document.querySelectorAll('meta[name="theme-color"]')].map(meta=>[meta.getAttribute('media'),meta.getAttribute('content')]),
  [['(prefers-color-scheme: light)','#ffffff'],['(prefers-color-scheme: dark)','#1d1e23']],
 );

 const css=document.querySelector('style')?.textContent??'';
 assert.match(css,/body\s*\{[^}]*box-sizing:\s*border-box;[^}]*height:\s*100dvh;[^}]*padding:\s*env\(safe-area-inset-top\)\s+env\(safe-area-inset-right\)\s+env\(safe-area-inset-bottom\)\s+env\(safe-area-inset-left\);[^}]*padding-top:\s*calc\(env\(safe-area-inset-top\)\s*\+\s*var\(--shell-top-clearance\)\);/s);
 assert.match(css,/:root\s*\{[^}]*--shell-top-clearance:\s*0px;[^}]*--shell-surface:\s*light-dark\(#fff,\s*#1d1e23\);/s);
 assert.match(css,/html,\s*body\s*\{[^}]*background:\s*var\(--shell-surface\);/s);
 assert.match(css,/#top-clearance-band\s*\{[^}]*position:\s*fixed;[^}]*height:\s*calc\(env\(safe-area-inset-top\)\s*\+\s*var\(--shell-top-clearance\)\);[^}]*display:\s*none;[^}]*background:\s*var\(--shell-surface\);/s);
 const displayModeRule=css.match(/@supports\s*\(-webkit-touch-callout:\s*none\)\s*\{\s*@media\s*([^\{]+)\{/);
 assert.equal(displayModeRule?.[1].trim(),'(display-mode: standalone) and (orientation: portrait), (display-mode: fullscreen) and (orientation: portrait)');
 assert.match(css,/@supports\s*\(-webkit-touch-callout:\s*none\)\s*\{\s*@media[^\{]+\{\s*:root\s*\{\s*--shell-top-clearance:\s*20px;\s*\}\s*#top-clearance-band\s*\{\s*display:\s*block;/s);
 assert.equal(document.body.firstElementChild?.id,'top-clearance-band');
 assert.equal(document.querySelector('#top-clearance-band')?.getAttribute('aria-hidden'),'true');
 const displayButton=document.querySelector('#display-info-d1-button');
 assert.equal(displayButton?.textContent,'Display info D1');
 assert.equal(displayButton?.hidden,false);
 assert.equal(document.querySelector('#display-info-d1-dialog')?.getAttribute('aria-modal'),'true');
 assert.ok(css.indexOf('#display-info-d1-button')>css.indexOf('#access {'), 'the diagnostic button is outside the WebKit display-mode rule');
 assert.match(css,/#display-info-d1-button\s*\{[^}]*position:\s*fixed;[^}]*left:\s*calc\(env\(safe-area-inset-left,\s*0px\)\s*\+\s*8px\);[^}]*bottom:\s*calc\(env\(safe-area-inset-bottom,\s*0px\)\s*\+\s*8px\);/s);
 assert.match(css,/#safe-area-probe\s*\{[^}]*padding-top:\s*env\(safe-area-inset-top\);[^}]*padding-bottom:\s*env\(safe-area-inset-bottom\);/s);
 assert.match(css,/#workspace\s*\{[^}]*flex:\s*1;[^}]*min-height:\s*0;/s);
 dom.window.close();
});

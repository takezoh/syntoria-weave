import {test} from 'node:test';
import assert from 'node:assert/strict';
import {LONG_PRESS_MS,PRESS_SLOP,pressMove,pressTimeout,swipeChoice} from '../../lib/ui/model/row-press.ts';

test('a press stays pending inside the slop, swipes when mostly sideways and is left to scrolling otherwise',()=>{
 assert.equal(PRESS_SLOP,10);assert.equal(LONG_PRESS_MS,500);
 assert.equal(pressMove('pending',6,6,true),'pending');
 assert.equal(pressMove('pending',30,10,true),'swipe');
 assert.equal(pressMove('pending',-30,-10,true),'swipe');
 assert.equal(pressMove('pending',12,10,true),'released','a diagonal move is not taken from scrolling');
 assert.equal(pressMove('pending',2,40,true),'released');
 assert.equal(pressMove('pending',40,0,false),'released','rows that cannot swipe leave sideways moves alone');
 for(const mode of ['swipe','hold','released'])assert.equal(pressMove(mode,200,200,true),mode,'only a pending press changes mode');
});

test('only a pending press on a movable row becomes a hold when the long-press delay ends',()=>{
 assert.equal(pressTimeout('pending',true),'hold');
 assert.equal(pressTimeout('pending',false),'pending');
 for(const mode of ['swipe','hold','released'])assert.equal(pressTimeout(mode,true),mode);
});

test('rightward swipes choose Done and then Dropped along one direction; leftward swipes ask AI',()=>{
 const allowed={finish:true,ask:true},width=300;
 assert.deepEqual(swipeChoice(40,width,allowed),{offset:40,side:'finish',choice:null});
 assert.deepEqual(swipeChoice(75,width,allowed),{offset:75,side:'finish',choice:'done'});
 assert.deepEqual(swipeChoice(164,width,allowed),{offset:164,side:'finish',choice:'done'});
 assert.deepEqual(swipeChoice(165,width,allowed),{offset:165,side:'finish',choice:'drop'});
 assert.deepEqual(swipeChoice(500,width,allowed),{offset:300,side:'finish',choice:'drop'},'the row never travels past its width');
 assert.deepEqual(swipeChoice(-74,width,allowed),{offset:-74,side:'ask',choice:null});
 assert.deepEqual(swipeChoice(-75,width,allowed),{offset:-75,side:'ask',choice:'ask'});
 assert.deepEqual(swipeChoice(-400,width,allowed),{offset:-180,side:'ask',choice:'ask'});
 assert.deepEqual(swipeChoice(0,width,allowed),{offset:0,side:null,choice:null});
 const narrow=swipeChoice(64,120,allowed);assert.equal(narrow.choice,'done','a narrow row keeps a reachable Done distance');
 assert.equal(swipeChoice(135,120,allowed).choice,'done');assert.equal(swipeChoice(136,120,allowed).choice,'drop','Dropped stays clearly beyond Done');
});

test('a direction that is not allowed only resists and never chooses',()=>{
 assert.deepEqual(swipeChoice(200,300,{finish:false,ask:true}),{offset:16,side:null,choice:null});
 assert.deepEqual(swipeChoice(50,300,{finish:false,ask:true}),{offset:10,side:null,choice:null});
 assert.deepEqual(swipeChoice(-200,300,{finish:true,ask:false}),{offset:-16,side:null,choice:null});
});

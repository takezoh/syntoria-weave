import {test} from 'node:test';
import assert from 'node:assert/strict';
import {movePull,releasePull} from '../../lib/ui/model/pull-refresh.ts';
const initial=()=>({phase:'pending',distance:0});
test('pull requires downward intent and release past threshold; reversing cancels readiness',()=>{
 const start=initial();assert.deepEqual(movePull(start,2,4),start);
 assert.equal(releasePull(movePull(start,0,100)),false);
 const armed=movePull(start,2,140);assert.equal(releasePull(armed),true);
 assert.equal(releasePull(movePull(armed,0,20)),false);
 assert.deepEqual(start,initial());assert.equal(movePull(start,0,500).distance,96);
});
test('sideways or upward gestures remain canceled even when later dragged downward',()=>{
 for(const [x,y] of [[30,10],[0,-30]]){const canceled=movePull(initial(),x,y);assert.equal(canceled.phase,'canceled');assert.equal(releasePull(movePull(canceled,0,200)),false);}
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {quickDates} from '../../lib/ui/model/date-input.ts';
import {describeChange,projectChangeFeed,changeNames,changeActor,actorLabel,isUnreviewed,validRecentChangePage} from '../../lib/ui/model/changes.ts';
import {needsPerson} from '../../lib/ui/model/collaboration.ts';
import {createChangesController} from '../../lib/ui/application/changes.ts';
import {createReviewMarkStore} from '../../lib/ui/effects/review-mark.ts';

const uuid=value=>`00000000-0000-4000-8000-${String(value).padStart(12,'0')}`;
const base={id:uuid(1),title:'Trip',notes:'',metadata:'',revision:1,parent_id:null,project_id:null,status:'active',due_at:null,defer_until:null,order:0,flagged:false,created_at:'2026-10-01T00:00:00.000Z',updated_at:'2026-10-01T00:00:00.000Z'};
const delta=(actions=[],extra={})=>({actions,projects:[],tags:[],perspectives:[],action_tags:[],...extra});
const change=(revision,extra={})=>({operation_id:uuid(100+revision),revision_before:revision-1,revision_after:revision,committed_at:'2026-10-29T09:00:00.000Z',undo_of:null,client_id:'client-1',actor_kind:'client',summary:null,client_name:'ChatGPT',changes:delta(),undone_by:null,collaboration_id:null,undo:{status:'available'},...extra});
const names=changeNames({actions:[{id:uuid(1),title:'Trip'},{id:uuid(2),title:''}],projects:[{id:uuid(9),name:'Kyoto',path:'Travel / Kyoto'}],tags:[{id:uuid(8),name:'calls'}]});
const time=value=>'T'+value.slice(0,10);

test('quick dates are tomorrow and the next Monday after the local calendar day',()=>{
 assert.deepEqual(quickDates('2026-10-29'),{tomorrow:'2026-10-30',nextMonday:'2026-11-02'});
 assert.deepEqual(quickDates('2026-11-02'),{tomorrow:'2026-11-03',nextMonday:'2026-11-09'});
 assert.deepEqual(quickDates('2026-12-31'),{tomorrow:'2027-01-01',nextMonday:'2027-01-04'});
 assert.deepEqual(quickDates('2026-02-30'),{tomorrow:'',nextMonday:''});
});

test('change lines describe only persisted before/after values in plain language',()=>{
 const lines=item=>describeChange(change(1,item),names,time).map(line=>[line.verb,line.target,line.detail]);
 assert.deepEqual(lines({changes:delta([{before:null,after:{...base,project_id:uuid(9)}}])}),[['Added','Trip','to Travel / Kyoto']]);
 assert.deepEqual(lines({changes:delta([{before:null,after:{...base,id:uuid(3),title:'Pack',parent_id:uuid(1)}}])}),[['Added','Pack','inside Trip']]);
 const edited={...base,title:'Trip to Kyoto',status:'completed',flagged:true,due_at:'2026-11-02T00:00:00.000Z',defer_until:'2026-11-01T00:00:00.000Z',notes:'n',project_id:uuid(9)};
 assert.deepEqual(lines({changes:delta([{before:base,after:edited}])}),[['Completed','Trip to Kyoto',''],['Renamed','Trip to Kyoto','was “Trip”'],['Edited notes','Trip to Kyoto',''],['Flagged','Trip to Kyoto',''],['Set deadline','Trip to Kyoto','T2026-11-02'],['Hid until','Trip to Kyoto','T2026-11-01'],['Moved','Trip to Kyoto','to Travel / Kyoto']]);
 assert.deepEqual(lines({changes:delta([{before:{...base,status:'on-hold'},after:base}])}),[['No longer waiting','Trip','']]);
 assert.deepEqual(lines({changes:delta([{before:{...base,status:'dropped'},after:base}])}),[['Reopened','Trip','']]);
 assert.deepEqual(lines({changes:delta([{before:base,after:{...base,order:4}}])}),[['Reordered','Trip','']]);
 assert.deepEqual(lines({changes:delta([{before:base,after:{...base,metadata:'x'}}])}),[['Updated app data for','Trip','']]);
 assert.deepEqual(lines({changes:delta([],{action_tags:[{before:null,after:{action_id:uuid(1),tag_id:uuid(8),revision:2}}],projects:[{before:{id:uuid(9),name:'Kyoto'},after:{id:uuid(9),name:'Kyoto trip'}}]})}),[['Tagged','Trip','calls'],['Renamed project','Kyoto trip','was “Kyoto”']]);
 assert.deepEqual(lines({undo_of:uuid(7),changes:delta([{before:{...base,flagged:true},after:base}])}),[['Undid','an earlier save',''],['Unflagged','Trip','']]);
 assert.deepEqual(lines({collaboration_id:uuid(6)}),[['Updated','AI collaboration records','']]);
 assert.deepEqual(lines({changes:delta([{before:null,after:{...base,parent_id:uuid(404)}}])}),[['Added','Trip','inside another action']]);
});

test('the change feed filters by who made each save, groups by day and explains why Undo is unavailable',()=>{
 const items=[change(5,{summary:'Saved from your message.'}),change(4,{actor_kind:'user',client_name:null,undo:{status:'conflict'}}),change(3,{undo_of:uuid(102),undo:{status:'not_undoable'},committed_at:'2026-10-28T09:00:00.000Z'}),change(2,{undo:{status:'undone'},committed_at:'2026-10-28T08:00:00.000Z'}),change(1,{actor_kind:null,client_id:null,client_name:null,collaboration_id:uuid(6),undo:{status:'not_undoable'},committed_at:'2026-10-28T07:00:00.000Z'})];
 const before=structuredClone(items);
 const project=extra=>projectChangeFeed({items,filter:'all',reviewedThrough:3,names,formatTime:time,formatClock:value=>value.slice(11,16),dayLabel:value=>value.slice(0,10),pendingUndo:null,blocked:false,...extra});
 const feed=project();
 assert.deepEqual(items,before);
 assert.deepEqual(feed.counts,{all:5,connections:3,you:1});
 assert.deepEqual(feed.groups.map(group=>[group.label,group.cards.map(card=>card.revision)]),[['2026-10-29',[5,4]],['2026-10-28',[3,2,1]]]);
 const cards=feed.groups.flatMap(group=>group.cards);
 assert.deepEqual(cards.map(card=>card.actor),[{kind:'connection',label:'ChatGPT'},{kind:'you',label:'You'},{kind:'connection',label:'ChatGPT'},{kind:'connection',label:'ChatGPT'},{kind:'unknown',label:'Unknown source'}]);
 assert.deepEqual(cards.map(card=>card.isNew),[true,false,false,false,false]);assert.equal(feed.unreviewed,1);assert.equal(feed.reviewed,true);
 assert.equal(cards[0].summary,'Saved from your message.');assert.equal(cards[0].time,'09:00');
 assert.deepEqual(cards.map(card=>[card.undo.available,card.undo.reason]),[[true,''],[false,'Can’t undo: a later change to the same item would be lost.'],[false,'This save was itself an Undo.'],[false,'Already undone.'],[false,'Collaboration records change through their own decisions.']]);
 assert.deepEqual(project({filter:'you'}).groups.flatMap(group=>group.cards).map(card=>card.revision),[4]);
 assert.deepEqual(project({filter:'connections',limit:2}).groups.flatMap(group=>group.cards).map(card=>card.revision),[5,3]);
 assert.deepEqual(project({pendingUndo:items[0].operation_id}).groups[0].cards[0].undo,{available:false,pending:true,reason:'Undoing…'});
 assert.deepEqual(project({blocked:true}).groups[0].cards[0].undo,{available:false,pending:false,reason:'Finish the pending save before undoing.'});
 const unmarked=project({reviewedThrough:null});assert.equal(unmarked.unreviewed,0);assert.equal(unmarked.reviewed,false);
 const many=change(9,{changes:delta(Array.from({length:8},(_,index)=>({before:null,after:{...base,id:uuid(20+index),title:'Item '+index}})))});
 const card=projectChangeFeed({items:[many],filter:'all',reviewedThrough:null,names,formatTime:time,formatClock:time,dayLabel:()=>'Today',pendingUndo:null,blocked:false}).groups[0].cards[0];
 assert.deepEqual([card.lines.length,card.hiddenLines,card.countLabel],[6,2,'8 changes']);
});

test('actors, review marks, collaboration attention and page validation follow their display contracts',()=>{
 assert.deepEqual(changeActor({actor_kind:'client',client_name:null}),{kind:'connection',label:'Connected app'});
 assert.equal(actorLabel(null),null);assert.equal(actorLabel({kind:'user',client_id:'web'}),'you');assert.equal(actorLabel({kind:'client',client_id:'c',client_name:'Claude'}),'Claude');assert.equal(actorLabel({kind:'client',client_id:'c',client_name:null}),'a connected app');
 assert.equal(isUnreviewed({actor_kind:'client',revision_after:4},3),true);assert.equal(isUnreviewed({actor_kind:'user',revision_after:4},3),false);assert.equal(isUnreviewed({actor_kind:'client',revision_after:3},3),false);assert.equal(isUnreviewed({actor_kind:'client',revision_after:4},null),false);
 const record=extra=>({decision:'accepted',progress:'not_started',next_actor:'none',outcome:'none',stop_requested:false,...extra});
 assert.equal(needsPerson(record({progress:'waiting',next_actor:'user'}),'active'),true);
 assert.equal(needsPerson(record({progress:'waiting',next_actor:'external'}),'active'),false);
 assert.equal(needsPerson(record({decision:'pending'}),undefined),true);
 assert.equal(needsPerson(record({progress:'reported',outcome:'success'}),'on-hold'),true);
 assert.equal(needsPerson(record({progress:'reported',outcome:'success'}),'completed'),false);
 assert.equal(needsPerson(record({outcome:'unknown',progress:'running'}),'active'),true);
 assert.equal(needsPerson(record({progress:'running'}),'active'),false);
 assert.equal(needsPerson(record({decision:'withdrawn'}),'active'),false);
 assert.equal(validRecentChangePage({head_revision:1,next_before_revision:null,changes:[change(1)]}),true);
 for(const invalid of [null,{head_revision:'1',next_before_revision:null,changes:[]},{head_revision:1,next_before_revision:null,changes:[{...change(1),undo:{status:'maybe'}}]},{head_revision:1,next_before_revision:null,changes:[{...change(1),changes:{actions:[]}}]}])assert.equal(validRecentChangePage(invalid),false);
});

test('recent changes load only for visible review views, ignore stale responses and keep the review mark through its port',async()=>{
 const calls=[],pending=[],written=[];let notified=0;
 const call=(name,args)=>{calls.push([name,args]);return new Promise((resolve,reject)=>pending.push({resolve,reject}));};
 const controller=createChangesController({call,reviewMarks:{read:()=>2,write:value=>written.push(value)},changed:()=>notified++});
 assert.equal(controller.state.reviewedThrough,2);
 controller.sync(5,false);assert.equal(calls.length,0);
 controller.sync(5,true);controller.sync(5,true);assert.equal(calls.length,1);assert.deepEqual(calls[0],['list_recent_changes',{limit:20}]);assert.equal(controller.state.status,'loading');
 controller.sync(6,true);assert.equal(calls.length,2);
 pending[1].resolve({head_revision:6,next_before_revision:5,changes:[change(6)]});await Promise.resolve();await Promise.resolve();
 pending[0].resolve({head_revision:5,next_before_revision:null,changes:[change(5)]});await Promise.resolve();await Promise.resolve();
 assert.deepEqual(controller.state.items.map(item=>item.revision_after),[6],'the older response never replaces the newer one');assert.equal(controller.state.status,'ready');
 const more=controller.loadMore();assert.deepEqual(calls[2],['list_recent_changes',{before_revision:5,limit:20}]);pending[2].resolve({head_revision:6,next_before_revision:null,changes:[change(6),change(5)]});await more;
 assert.deepEqual(controller.state.items.map(item=>item.revision_after),[6,5]);assert.equal(controller.state.nextBeforeRevision,null);
 controller.setFilter('you');assert.equal(controller.state.filter,'you');
 controller.markReviewed();assert.deepEqual(written,[6]);assert.equal(controller.state.reviewedThrough,6);controller.markReviewed();assert.deepEqual(written,[6]);
 controller.sync(7,true);pending[3].resolve({head_revision:7,changes:'invalid'});await Promise.resolve();await Promise.resolve();
 assert.equal(controller.state.status,'error');assert.match(controller.state.error,/could not be verified/);assert.deepEqual(controller.state.items.map(item=>item.revision_after),[6,5],'a failed reload keeps the last confirmed list');
 controller.retry(7);pending[4].reject(Object.assign(new Error('Unavailable'),{code:'unavailable'}));await Promise.resolve();await Promise.resolve();assert.equal(controller.state.error,'Unavailable');
 assert.ok(notified>0);
 const beyond=createChangesController({call:async()=>({head_revision:3,next_before_revision:null,changes:[]}),reviewMarks:{read:()=>9,write:()=>assert.fail('reading never writes the mark')},changed:()=>{}});
 beyond.sync(3,true);await new Promise(resolve=>setTimeout(resolve,0));assert.equal(beyond.state.reviewedThrough,null,'a mark from another account or timeline is ignored');
});

test('the review mark store survives absent or throwing storage and ignores malformed values',()=>{
 const values=new Map();const storage={getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value)};
 const store=createReviewMarkStore(()=>storage);assert.equal(store.read(),null);store.write(4);assert.equal(values.get('action-tools.review-mark.v1'),'{"revision":4}');assert.equal(createReviewMarkStore(()=>storage).read(),4);
 for(const raw of ['{"revision":-1}','{"revision":1.5}','not json','{"other":2}'])assert.equal(createReviewMarkStore(()=>({getItem:()=>raw,setItem(){}})).read(),null);
 const throwing=createReviewMarkStore(()=>({getItem(){throw new Error('denied');},setItem(){throw new Error('denied');}}));throwing.write(8);assert.equal(throwing.read(),8,'the mark lasts in memory for this UI');
 const absent=createReviewMarkStore(()=>null);absent.write(2);assert.equal(absent.read(),2);
});

import {actionCall} from '../../lib/application/action-service.ts';
import {createD1ActionStore as createScopedD1ActionStore} from '../../lib/adapters/d1-action-store.ts';
import {createHash} from 'node:crypto';
export function createD1ActionStore(db) {
 const bound=user=>createScopedD1ActionStore(db,{userId:user});
 return {readSnapshot:user=>bound(user).readSnapshot(),readOperationState:(user,op)=>bound(user).readOperationState(op),readChangeWindow:(user,after,through)=>bound(user).readChangeWindow(after,through),readReceipt:(user,op)=>bound(user).readReceipt(op),hasUndo:(user,op)=>bound(user).hasUndo(op),commit:({user,...command})=>bound(user).commit(command)};
}
export function actionCallForUser(ports,user,name,args) {
 const store=ports.store;
 const userScope=()=>createHash('sha256').update('action-tools/change-cursor/scope/v1\0').update(user).digest('base64url');
 return actionCall({...ports,store:{readSnapshot:()=>store.readSnapshot(user),readOperationState:op=>store.readOperationState(user,op),readChangeWindow:(after,through)=>store.readChangeWindow(user,after,through),...(store.readRecentChanges?{readRecentChanges:(before,limit)=>store.readRecentChanges(user,before,limit)}:{}),readReceipt:op=>store.readReceipt(user,op),hasUndo:op=>store.hasUndo(user,op),commit:command=>store.commit({...command,user})},changeCursorScope:ports.changeCursorScope?()=>ports.changeCursorScope(user):async()=>userScope()},name,args);
}

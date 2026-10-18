import {actionCallForUser,createD1ActionStore} from './user-composition.mjs';
export {ActionError} from '../../lib/domain/core.ts';
export {requireUser} from '../../lib/server/auth.ts';
export function actionCall(db,user,name,args,clock=()=>new Date().toISOString()){return actionCallForUser({store:createD1ActionStore(db),clock,newId:()=>crypto.randomUUID()},user,name,args);}

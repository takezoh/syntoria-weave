import {database} from '../adapters/worker-database';
import {createUserBoundActionStore} from '../adapters/d1-action-store';
import {actionCall as invoke} from '../application/action-service';
import {changeCursorScope} from './change-cursor-scope';
export {ActionError} from '../domain/core';
export {requireUser} from './auth';
import type {VerifiedIdentity} from './auth';

/** Trusted composition root: bind the verified identity before invoking the application. */
export function actionCall(user:VerifiedIdentity,name:string,args:unknown){return invoke({store:createUserBoundActionStore(database(),user),clock:()=>new Date().toISOString(),newId:()=>crypto.randomUUID(),changeCursorScope:()=>changeCursorScope(user)},name,args);}

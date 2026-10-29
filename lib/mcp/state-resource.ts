export const STATE_RESOURCE_URI='action-state://current';
export const ASSIGNED_RESOURCE_URI='action-state://assigned';
export const RESOURCE_URIS:readonly string[]=[STATE_RESOURCE_URI,ASSIGNED_RESOURCE_URI];
export const stateResource={uri:STATE_RESOURCE_URI,name:'current-action-state',title:'Current actions and proposals',mimeType:'application/json',description:'User-scoped shared state. Subscribe for change notifications, then read again. Approval is not execution permission.'};
export const assignedResource={uri:ASSIGNED_RESOURCE_URI,name:'assigned-collaboration',title:'Work for this connection',mimeType:'application/json',description:'Collaboration records that concern the reading connection, with reasons. Subscribe to be notified only when this content changes, then read again. A notification is a hint, never permission; any connection may start open work.'};
export function stateUpdated(cursor:string,revision:number){return {jsonrpc:'2.0',method:'notifications/resources/updated',params:{uri:STATE_RESOURCE_URI,_meta:{change_cursor:cursor,revision}}};}
export function assignedUpdated(revision:number){return {jsonrpc:'2.0',method:'notifications/resources/updated',params:{uri:ASSIGNED_RESOURCE_URI,_meta:{revision}}};}

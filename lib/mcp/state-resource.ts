export const STATE_RESOURCE_URI='action-state://current';
export const stateResource={uri:STATE_RESOURCE_URI,name:'current-action-state',title:'Current actions and proposals',mimeType:'application/json',description:'User-scoped shared state. Subscribe for change notifications, then read again. Approval is not execution permission.'};
export function stateUpdated(cursor:string,revision:number){return {jsonrpc:'2.0',method:'notifications/resources/updated',params:{uri:STATE_RESOURCE_URI,_meta:{change_cursor:cursor,revision}}};}

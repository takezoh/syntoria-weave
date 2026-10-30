import type {EventDefinition} from '../webhook/subscriptions';

export const COLLABORATION_CHANGED='collaboration_changed';

/** The webhook event catalog. Each event is an identifier-only hint to reread current state, never a command or approval. */
export const eventCatalog=Object.freeze([Object.freeze({
 name:COLLABORATION_CHANGED,
 description:'Collaboration work that concerns this connection changed: a request was sent to it or opened to any AI, or a request it handles was approved, revised, withdrawn, reassigned or stopped. Read the collaboration with get_collaboration and the current state before acting; the event is a hint, not permission.',
 delivery:['webhook'],
 inputSchema:{type:'object',properties:{},additionalProperties:false},
 payloadSchema:{type:'object',properties:{collaboration_id:{type:'string'},action_id:{type:['string','null']},revision:{type:'integer',minimum:0}},required:['collaboration_id','action_id','revision'],additionalProperties:false},
})]);

export const eventDefinitions:readonly EventDefinition[]=Object.freeze([{name:COLLABORATION_CHANGED,acceptsArguments:args=>Object.keys(args).length===0}]);

import type {Principal} from './principal';
import type {McpEvents} from '../../mcp/dispatcher';
import {eventDefinitions} from '../../mcp/event-definitions';
import {createSubscriptions} from '../../webhook/subscriptions';
import type {CallbackTransport,SubscriptionStore,WebhookCrypto} from '../../webhook/ports';

/** Binds webhook subscriptions to the verified connection of each request; the owner never comes from request arguments. */
export function webhookEvents({stores,crypto,transport,clock=()=>Date.now()}:{
 stores:(principal:Principal)=>SubscriptionStore;crypto:WebhookCrypto;transport:CallbackTransport;clock?:()=>number;
}):(principal:Principal)=>McpEvents {
 return principal=>createSubscriptions({store:stores(principal),crypto,transport,clock,events:eventDefinitions,
  owner:{issuer:principal.issuer,subject:principal.subject,clientId:principal.clientId,connectionId:principal.connectionId}});
}

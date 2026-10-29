import type {Principal} from './principal';

/** Transport subscriptions are connection-scoped metadata, never work authorization. */
export interface McpSubscriptions {
 set(principal:Principal,resource:string,subscribed:boolean):Promise<void>;
 /** The unexpired resources this connection subscribes to. */
 list(principal:Principal):Promise<readonly string[]>;
}

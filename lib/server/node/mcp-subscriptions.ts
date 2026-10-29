import type {Principal} from './principal';

/** Transport subscriptions are connection-scoped metadata, never work authorization. */
export interface McpSubscriptions {
 set(principal:Principal,subscribed:boolean):Promise<void>;
 has(principal:Principal):Promise<boolean>;
}

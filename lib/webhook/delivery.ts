import type {CallbackFailureReason} from './ports';

/** A delivery is sent at most this many times, and never after this age, whatever the queue still retries. */
export const DELIVERY_LIMITS={attempts:8,ageMs:24*3_600_000} as const;
/** Fan-out creates at most this many delivery tasks per invocation before it hands over to a continuation. */
export const FANOUT_PAGE=25;

export type DeliveryState='pending'|'delivered'|'stopped'|'failed'|'exhausted';
/** What one attempt means: done, stop the whole subscription, end this delivery, or retry later. */
export type AttemptOutcome='delivered'|'stop_subscription'|'failed'|'retry';

/** Whether another POST may be admitted for a pending delivery. */
export function admitAttempt({attempts,createdAt,now}:{attempts:number;createdAt:number;now:number}):'send'|'exhausted' {
 return attempts>=DELIVERY_LIMITS.attempts||now-createdAt>=DELIVERY_LIMITS.ageMs?'exhausted':'send';
}

/** 2xx delivers; 410 ends the subscription; 413 and other permanent statuses end the delivery; the rest is retried. */
export function classifyAttempt(result:Readonly<{status:number}>|Readonly<{failure:CallbackFailureReason}>):AttemptOutcome {
 if('failure' in result)return 'retry';
 const status=result.status;
 if(status>=200&&status<300)return 'delivered';
 if(status===410)return 'stop_subscription';
 if(status===408||status===429||status>=500)return 'retry';
 return 'failed';
}

/** The state a delivery keeps after a retryable outcome: still pending unless the last admitted attempt was spent. */
export function afterRetry({attempts,createdAt,now}:{attempts:number;createdAt:number;now:number}):Extract<DeliveryState,'pending'|'exhausted'> {
 return admitAttempt({attempts,createdAt,now})==='send'?'pending':'exhausted';
}

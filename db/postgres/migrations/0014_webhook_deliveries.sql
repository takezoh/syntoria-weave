CREATE TABLE state.webhook_batches (
 user_id text COLLATE "C" NOT NULL,
 id text COLLATE "C" NOT NULL,
 operation_id text NOT NULL,
 revision bigint NOT NULL,
 size integer NOT NULL CHECK (size>0),
 cursor integer NOT NULL DEFAULT 0 CHECK (cursor>=0 AND cursor<=size),
 enqueue_state text NOT NULL CHECK (enqueue_state IN ('enqueued','not_enqueued')),
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(user_id,id),
 UNIQUE(user_id,operation_id)
);
CREATE INDEX webhook_batches_not_enqueued ON state.webhook_batches(user_id,created_at) WHERE enqueue_state='not_enqueued';
CREATE TABLE state.webhook_deliveries (
 user_id text COLLATE "C" NOT NULL,
 id text COLLATE "C" NOT NULL,
 batch_id text COLLATE "C" NOT NULL,
 position integer NOT NULL CHECK (position>=0),
 subscription_id text COLLATE "C" NOT NULL,
 subscription_generation bigint NOT NULL,
 body text NOT NULL CHECK (octet_length(body)<=262144),
 state text NOT NULL CHECK (state IN ('pending','delivered','stopped','failed','exhausted')),
 attempts integer NOT NULL DEFAULT 0 CHECK (attempts>=0),
 last_error text,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(user_id,id),
 UNIQUE(user_id,batch_id,position),
 FOREIGN KEY(user_id,batch_id) REFERENCES state.webhook_batches(user_id,id) ON DELETE CASCADE,
 FOREIGN KEY(user_id,subscription_id) REFERENCES state.webhook_subscriptions(user_id,id)
);
CREATE INDEX webhook_deliveries_subscription ON state.webhook_deliveries(user_id,subscription_id) WHERE state='pending';

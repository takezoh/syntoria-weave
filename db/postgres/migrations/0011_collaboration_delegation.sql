-- Who should handle approved or requested work: any AI, or one specified client. It is shared state
-- only and never restricts who may write. Records saved before this migration were open to any AI,
-- which is what they now state. Collaboration bodies are serialized JSON objects that begin with a key,
-- so the member is spliced in front without reinterpreting any stored text.
UPDATE state.collaborations SET body='{"delegation":{"mode":"any_ai","client_id":null},'||substr(body,2)
 WHERE left(body,2)='{"' AND position('"delegation":' in body)=0;
UPDATE state.collaboration_history SET body='{"delegation":{"mode":"any_ai","client_id":null},'||substr(body,2)
 WHERE left(body,2)='{"' AND position('"delegation":' in body)=0;

-- A connection may subscribe to the shared state, to the work that concerns it, or to both.
ALTER TABLE state.mcp_subscriptions
 ADD COLUMN resource text COLLATE "C" NOT NULL DEFAULT 'action-state://current'
 CHECK (resource IN ('action-state://current','action-state://assigned'));
ALTER TABLE state.mcp_subscriptions ALTER COLUMN resource DROP DEFAULT;
ALTER TABLE state.mcp_subscriptions DROP CONSTRAINT mcp_subscriptions_pkey, ADD PRIMARY KEY(user_id,connection_id,resource);

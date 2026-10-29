CREATE TABLE state.mcp_subscriptions (
 user_id text COLLATE "C" NOT NULL,
 connection_id text COLLATE "C" NOT NULL,
 expires_at timestamptz NOT NULL,
 PRIMARY KEY(user_id,connection_id)
);
ALTER TABLE state.mcp_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE state.mcp_subscriptions FORCE ROW LEVEL SECURITY;
CREATE POLICY user_access ON state.mcp_subscriptions USING (user_id=current_setting('app.user_id',true)) WITH CHECK (user_id=current_setting('app.user_id',true));

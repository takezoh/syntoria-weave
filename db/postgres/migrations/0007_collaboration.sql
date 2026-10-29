CREATE TABLE state.collaborations (
 user_id text COLLATE "C" NOT NULL, id text COLLATE "C" NOT NULL,
 action_id text COLLATE "C", revision state.safe_integer NOT NULL,
 body text NOT NULL CHECK (json_typeof(body::json)='object'),
 PRIMARY KEY(user_id,id),
 FOREIGN KEY(user_id,action_id) REFERENCES state.actions(user_id,id) DEFERRABLE INITIALLY DEFERRED
);
CREATE INDEX collaborations_action ON state.collaborations(user_id,action_id);
CREATE TABLE state.collaboration_history (
 user_id text COLLATE "C" NOT NULL, operation_id text COLLATE "C" NOT NULL,
 collaboration_id text COLLATE "C" NOT NULL, revision state.safe_integer NOT NULL,
 command text NOT NULL, actor text NOT NULL CHECK (json_typeof(actor::json)='object'),
 body text NOT NULL CHECK (json_typeof(body::json)='object'),
 canonical_payload text NOT NULL CHECK (json_typeof(canonical_payload::json)='object'),
 result text NOT NULL CHECK (json_typeof(result::json)='object'),
 delta text NOT NULL CHECK (json_typeof(delta::json)='object'),
 PRIMARY KEY(user_id,operation_id), UNIQUE(user_id,revision),
 FOREIGN KEY(user_id,collaboration_id) REFERENCES state.collaborations(user_id,id) DEFERRABLE INITIALLY DEFERRED
);
CREATE INDEX collaboration_history_record ON state.collaboration_history(user_id,collaboration_id,revision);
ALTER TABLE state.collaborations ENABLE ROW LEVEL SECURITY;
ALTER TABLE state.collaborations FORCE ROW LEVEL SECURITY;
CREATE POLICY user_access ON state.collaborations USING (user_id=current_setting('app.user_id',true)) WITH CHECK (user_id=current_setting('app.user_id',true));
ALTER TABLE state.collaboration_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE state.collaboration_history FORCE ROW LEVEL SECURITY;
CREATE POLICY user_access ON state.collaboration_history USING (user_id=current_setting('app.user_id',true)) WITH CHECK (user_id=current_setting('app.user_id',true));

CREATE SCHEMA IF NOT EXISTS state;
CREATE SCHEMA IF NOT EXISTS identity;
CREATE DOMAIN state.safe_integer AS bigint CHECK (VALUE BETWEEN 0 AND 9007199254740991);
CREATE DOMAIN state.text_cell AS text CHECK (json_typeof(VALUE::json) = 'string');
CREATE TABLE state.projects (
 owner text COLLATE "C" NOT NULL, id text COLLATE "C" NOT NULL, name state.text_cell COLLATE "C" NOT NULL,
 description state.text_cell NOT NULL, parent_id text COLLATE "C", "order" state.safe_integer NOT NULL,
 revision state.safe_integer NOT NULL, created_at text NOT NULL, updated_at text NOT NULL,
 PRIMARY KEY(owner,id), FOREIGN KEY(owner,parent_id) REFERENCES state.projects(owner,id) DEFERRABLE INITIALLY DEFERRED
);
CREATE TABLE state.tags (LIKE state.projects INCLUDING ALL);
ALTER TABLE state.tags ADD FOREIGN KEY(owner,parent_id) REFERENCES state.tags(owner,id) DEFERRABLE INITIALLY DEFERRED;
CREATE UNIQUE INDEX projects_root_name ON state.projects(owner,name) WHERE parent_id IS NULL;
CREATE UNIQUE INDEX projects_child_name ON state.projects(owner,parent_id,name) WHERE parent_id IS NOT NULL;
CREATE UNIQUE INDEX tags_root_name ON state.tags(owner,name) WHERE parent_id IS NULL;
CREATE UNIQUE INDEX tags_child_name ON state.tags(owner,parent_id,name) WHERE parent_id IS NOT NULL;
CREATE INDEX projects_parent ON state.projects(owner,parent_id);
CREATE INDEX tags_parent ON state.tags(owner,parent_id);
CREATE TABLE state.actions (
 owner text COLLATE "C" NOT NULL, id text COLLATE "C" NOT NULL, title state.text_cell NOT NULL, notes state.text_cell NOT NULL,
 revision state.safe_integer NOT NULL, parent_id text COLLATE "C", project_id text COLLATE "C",
 status text NOT NULL CHECK(status IN ('active','on-hold','completed','dropped')),
 due_at text, defer_until text, "order" state.safe_integer NOT NULL, flagged boolean NOT NULL,
 created_at text NOT NULL, updated_at text NOT NULL, PRIMARY KEY(owner,id),
 FOREIGN KEY(owner,parent_id) REFERENCES state.actions(owner,id) DEFERRABLE INITIALLY DEFERRED,
 FOREIGN KEY(owner,project_id) REFERENCES state.projects(owner,id) DEFERRABLE INITIALLY DEFERRED
);
CREATE INDEX actions_parent ON state.actions(owner,parent_id);
CREATE INDEX actions_project ON state.actions(owner,project_id);
CREATE TABLE state.action_tags (
 owner text COLLATE "C" NOT NULL, action_id text COLLATE "C" NOT NULL, tag_id text COLLATE "C" NOT NULL, revision state.safe_integer NOT NULL,
 PRIMARY KEY(owner,action_id,tag_id),
 FOREIGN KEY(owner,action_id) REFERENCES state.actions(owner,id) DEFERRABLE INITIALLY DEFERRED,
 FOREIGN KEY(owner,tag_id) REFERENCES state.tags(owner,id) DEFERRABLE INITIALLY DEFERRED
);
CREATE INDEX action_tags_reverse ON state.action_tags(owner,tag_id,action_id);
CREATE TABLE state.catalog_identity_ledger (
 owner text COLLATE "C" NOT NULL,kind text NOT NULL CHECK(kind IN ('project','tag','action_tag','perspective')),
 identity text COLLATE "C" NOT NULL,revision state.safe_integer NOT NULL,PRIMARY KEY(owner,kind,identity)
);
CREATE TABLE state.perspectives (
 owner text COLLATE "C" NOT NULL,id text COLLATE "C" NOT NULL,name state.text_cell NOT NULL,description state.text_cell NOT NULL,
 filter text NOT NULL CHECK(json_typeof(filter::json)='object'),definition_version integer NOT NULL CHECK(definition_version IN(1,2)),
 revision state.safe_integer NOT NULL,created_at text NOT NULL,updated_at text NOT NULL,PRIMARY KEY(owner,id)
);
CREATE TABLE state.operations (
 owner text COLLATE "C" NOT NULL,operation_id text COLLATE "C" NOT NULL,canonical_payload text NOT NULL CHECK(json_typeof(canonical_payload::json)='object'),
 result text NOT NULL CHECK(json_typeof(result::json)='object'),delta text NOT NULL CHECK(json_typeof(delta::json)='object'),
 revision_before state.safe_integer NOT NULL,revision_after state.safe_integer NOT NULL,undo_of text COLLATE "C",created_at text NOT NULL,
 PRIMARY KEY(owner,operation_id),UNIQUE(owner,revision_after),CHECK(revision_after=revision_before+1)
);
CREATE INDEX operations_undo ON state.operations(owner,undo_of) WHERE undo_of IS NOT NULL;
DO $$ DECLARE name text; BEGIN
 FOREACH name IN ARRAY ARRAY['actions','projects','tags','action_tags','perspectives','catalog_identity_ledger','operations'] LOOP
  EXECUTE format('ALTER TABLE state.%I ENABLE ROW LEVEL SECURITY',name);
  EXECUTE format('ALTER TABLE state.%I FORCE ROW LEVEL SECURITY',name);
  EXECUTE format('CREATE POLICY owner_access ON state.%I USING (owner=current_setting(''app.owner'',true)) WITH CHECK (owner=current_setting(''app.owner'',true))',name);
 END LOOP;
END $$;
CREATE TABLE identity.subjects (
 issuer text NOT NULL,subject text NOT NULL,owner text COLLATE "C" NOT NULL,enabled boolean NOT NULL DEFAULT true,PRIMARY KEY(issuer,subject)
);
CREATE TABLE identity.client_grants (
 issuer text NOT NULL,subject text NOT NULL,client_id text NOT NULL,scopes text[] NOT NULL,enabled boolean NOT NULL DEFAULT true,
 PRIMARY KEY(issuer,subject,client_id),FOREIGN KEY(issuer,subject) REFERENCES identity.subjects(issuer,subject)
);
CREATE TABLE identity.sessions (
 token_hash text PRIMARY KEY,issuer text NOT NULL,subject text NOT NULL,client_id text NOT NULL,
 expires_at timestamptz NOT NULL,last_activity timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(issuer,subject,client_id) REFERENCES identity.client_grants(issuer,subject,client_id)
);
CREATE INDEX sessions_expiry ON identity.sessions(expires_at);
CREATE TABLE identity.login_attempts (
 state_hash text PRIMARY KEY,binding_hash text NOT NULL,verifier text NOT NULL,nonce text NOT NULL,
 return_to text NOT NULL,channel text NOT NULL,expires_at timestamptz NOT NULL
);
CREATE INDEX login_expiry ON identity.login_attempts(expires_at);

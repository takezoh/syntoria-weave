-- Existing cookies must authenticate again; no access credential is invented for them.
ALTER TABLE identity.sessions ADD COLUMN encrypted_tokens text;
ALTER TABLE identity.sessions ADD COLUMN connection_id text;
ALTER TABLE identity.sessions ADD CONSTRAINT session_gate_credentials CHECK ((encrypted_tokens IS NULL) = (connection_id IS NULL));

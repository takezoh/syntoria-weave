-- Provenance only: the verified OAuth client that committed each operation. It selects no user and
-- grants nothing. Operations committed before this migration keep NULL because their client is unknown.
ALTER TABLE state.operations
 ADD COLUMN client_id text COLLATE "C" CHECK (client_id IS NULL OR char_length(client_id) BETWEEN 1 AND 255);

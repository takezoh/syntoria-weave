-- Display and provenance data for reviewing changes. Nothing here grants, selects or restricts
-- access, and none of it enters persisted Action DTOs, deltas or Undo.

-- The caller's own description of what an operation did, shown as its claim beside the actual
-- changes. Operations committed before this migration, or without a description, keep NULL.
ALTER TABLE state.operations ADD COLUMN summary state.text_cell;

-- Who created and last changed each Action, from the verified request that committed the change.
-- NULL means unknown, as for every Action saved before this migration.
ALTER TABLE state.actions
 ADD COLUMN created_by_kind text COLLATE "C" CHECK (created_by_kind IS NULL OR created_by_kind IN ('user','client')),
 ADD COLUMN created_by_client_id text COLLATE "C" CHECK (created_by_client_id IS NULL OR char_length(created_by_client_id) BETWEEN 1 AND 255),
 ADD COLUMN updated_by_kind text COLLATE "C" CHECK (updated_by_kind IS NULL OR updated_by_kind IN ('user','client')),
 ADD COLUMN updated_by_client_id text COLLATE "C" CHECK (updated_by_client_id IS NULL OR char_length(updated_by_client_id) BETWEEN 1 AND 255);

-- The latest unverified registration name each connected client reported through Gate, recorded
-- when the client writes. Display only; the client ID remains the identity.
CREATE TABLE state.client_names (
 user_id text COLLATE "C" NOT NULL,
 client_id text COLLATE "C" NOT NULL CHECK (char_length(client_id) BETWEEN 1 AND 255),
 name state.text_cell NOT NULL,
 updated_at text NOT NULL,
 PRIMARY KEY(user_id,client_id)
);

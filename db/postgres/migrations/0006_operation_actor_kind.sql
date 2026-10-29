-- Provenance only: whether the person made the operation in the Weave app (browser session) or a
-- client connection made it for them. It grants nothing. Earlier operations keep NULL.
ALTER TABLE state.operations
 ADD COLUMN actor_kind text COLLATE "C" CHECK (actor_kind IS NULL OR actor_kind IN ('user','client'));

-- The checksummed companion performs the JSON transformation in JavaScript,
-- preserving UTF-16 text that PostgreSQL JSON operators cannot materialize.
-- Cutover requires a write fence and a new cursor epoch. History is immutable.
LOCK TABLE state.collaborations IN SHARE ROW EXCLUSIVE MODE;

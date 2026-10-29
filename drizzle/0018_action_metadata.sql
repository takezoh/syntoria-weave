ALTER TABLE actions ADD COLUMN metadata TEXT NOT NULL DEFAULT '';
--> statement-breakpoint
UPDATE operations
SET delta=json_set(delta,'$.actions',json((
 SELECT json_group_array(json_set(
  change.value,
  '$.before',CASE WHEN json_type(change.value,'$.before')='object'
                  THEN json_set(json_extract(change.value,'$.before'),'$.metadata','')
                  ELSE json_extract(change.value,'$.before') END,
  '$.after',CASE WHEN json_type(change.value,'$.after')='object'
                 THEN json_set(json_extract(change.value,'$.after'),'$.metadata','')
                 ELSE json_extract(change.value,'$.after') END
 ) ORDER BY CAST(change.key AS INTEGER))
 FROM json_each(operations.delta,'$.actions') AS change
)))
WHERE EXISTS (
 SELECT 1 FROM json_each(operations.delta,'$.actions') AS change
 WHERE (json_type(change.value,'$.before')='object' AND json_type(change.value,'$.before.metadata') IS NULL)
    OR (json_type(change.value,'$.after')='object' AND json_type(change.value,'$.after.metadata') IS NULL)
);

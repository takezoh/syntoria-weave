-- Store caller-managed operational text separately from human-facing notes.
-- The empty default is the JSON string encoding required by state.text_cell.
DO $$ BEGIN
 IF NOT EXISTS(
  SELECT 1 FROM pg_roles
  WHERE rolname=current_user AND (rolsuper OR rolbypassrls)
 ) THEN
  RAISE EXCEPTION 'Migration 0007 requires a superuser or BYPASSRLS migration role to update retained FORCE-RLS operation history.';
 END IF;
END $$;

ALTER TABLE state.actions
 ADD COLUMN metadata state.text_cell NOT NULL DEFAULT '""';

-- PostgreSQL JSON functions convert JSON strings to database text. That cannot
-- represent NUL or lone UTF-16 surrogates from saved Notes. Scan the serialized
-- JSON while honoring string escapes, and splice only missing Action members.
CREATE FUNCTION state.action_metadata_delta(delta_value text) RETURNS text
LANGUAGE plpgsql IMMUTABLE STRICT AS $$
DECLARE
 raw_bytes bytea:=convert_to(delta_value,'UTF8'); source_length integer:=octet_length(raw_bytes);
 actions_start integer:=0; actions_end integer:=0; changed_actions bytea:=convert_to('','UTF8');
 copy_from integer:=1; pos integer; probe integer; token_start integer;
 object_depth integer:=0; array_depth integer:=0; in_string boolean:=false; escaped boolean:=false;
 code integer; object_start integer; object_end integer; scan_pos integer; scan_depth integer;
 scan_in_string boolean; scan_escaped boolean; scan_token_start integer;
 has_metadata boolean; prefix text;
BEGIN
 -- Byte indexing keeps the scan linear even when Notes contain multibyte UTF-8 text.
 -- JSON syntax and escape markers are ASCII; escaped NUL/surrogates remain opaque bytes.
 pos:=1;
 WHILE pos<=source_length LOOP
  code:=get_byte(raw_bytes,pos-1);
  IF in_string THEN
   IF escaped THEN escaped:=false;
   ELSIF code=92 THEN escaped:=true;
   ELSIF code=34 THEN
    in_string:=false;
    IF object_depth=1 AND array_depth=0 AND convert_from(substring(raw_bytes FROM token_start+1 FOR pos-token_start-1),'UTF8')='actions' THEN
     probe:=pos+1;
     WHILE probe<=source_length AND get_byte(raw_bytes,probe-1) IN (32,9,10,13) LOOP probe:=probe+1; END LOOP;
     IF probe<=source_length AND get_byte(raw_bytes,probe-1)=58 THEN
      probe:=probe+1;
      WHILE probe<=source_length AND get_byte(raw_bytes,probe-1) IN (32,9,10,13) LOOP probe:=probe+1; END LOOP;
      IF probe<=source_length AND get_byte(raw_bytes,probe-1)=91 THEN actions_start:=probe;EXIT;END IF;
     END IF;
    END IF;
   END IF;
  ELSE
   IF code=34 THEN in_string:=true;token_start:=pos;
   ELSIF code=123 THEN object_depth:=object_depth+1;
   ELSIF code=125 THEN object_depth:=object_depth-1;
   ELSIF code=91 THEN array_depth:=array_depth+1;
   ELSIF code=93 THEN array_depth:=array_depth-1;
   END IF;
  END IF;
  pos:=pos+1;
 END LOOP;
 IF actions_start=0 THEN RETURN delta_value; END IF;
 copy_from:=actions_start;

 -- Locate the matching end of the actions array, ignoring quoted text.
 array_depth:=0;in_string:=false;escaped:=false;
 FOR pos IN actions_start..source_length LOOP
  code:=get_byte(raw_bytes,pos-1);
  IF in_string THEN
   IF escaped THEN escaped:=false;
   ELSIF code=92 THEN escaped:=true;
   ELSIF code=34 THEN in_string:=false;
   END IF;
  ELSE
   IF code=34 THEN in_string:=true;
   ELSIF code=91 THEN array_depth:=array_depth+1;
   ELSIF code=93 THEN
    array_depth:=array_depth-1;
    IF array_depth=0 THEN actions_end:=pos;EXIT;END IF;
   END IF;
  END IF;
 END LOOP;
 IF actions_end=0 THEN RETURN delta_value; END IF;

 -- Each row in actions is a before/after pair; those values are flat Action objects.
 pos:=actions_start+1;object_depth:=0;in_string:=false;escaped:=false;
 WHILE pos<actions_end LOOP
  code:=get_byte(raw_bytes,pos-1);
  IF in_string THEN
   IF escaped THEN escaped:=false;
   ELSIF code=92 THEN escaped:=true;
   ELSIF code=34 THEN
    in_string:=false;
    IF object_depth=1 AND convert_from(substring(raw_bytes FROM token_start+1 FOR pos-token_start-1),'UTF8') IN ('before','after') THEN
     probe:=pos+1;
     WHILE probe<actions_end AND get_byte(raw_bytes,probe-1) IN (32,9,10,13) LOOP probe:=probe+1; END LOOP;
     IF probe<actions_end AND get_byte(raw_bytes,probe-1)=58 THEN
      probe:=probe+1;
      WHILE probe<actions_end AND get_byte(raw_bytes,probe-1) IN (32,9,10,13) LOOP probe:=probe+1; END LOOP;
      IF probe<actions_end AND get_byte(raw_bytes,probe-1)=123 THEN
       object_start:=probe;object_end:=0;scan_depth:=0;scan_in_string:=false;scan_escaped:=false;
       FOR scan_pos IN object_start..actions_end LOOP
        code:=get_byte(raw_bytes,scan_pos-1);
        IF scan_in_string THEN
         IF scan_escaped THEN scan_escaped:=false;
         ELSIF code=92 THEN scan_escaped:=true;
         ELSIF code=34 THEN scan_in_string:=false;
         END IF;
        ELSE
         IF code=34 THEN scan_in_string:=true;
         ELSIF code=123 THEN scan_depth:=scan_depth+1;
         ELSIF code=125 THEN
          scan_depth:=scan_depth-1;
          IF scan_depth=0 THEN object_end:=scan_pos;EXIT;END IF;
         END IF;
        END IF;
       END LOOP;
       IF object_end=0 THEN RETURN delta_value; END IF;

       -- Detect a direct metadata key, never key-like text inside Notes.
       has_metadata:=false;scan_depth:=0;scan_in_string:=false;scan_escaped:=false;
       FOR scan_pos IN object_start..object_end LOOP
        code:=get_byte(raw_bytes,scan_pos-1);
        IF scan_in_string THEN
         IF scan_escaped THEN scan_escaped:=false;
         ELSIF code=92 THEN scan_escaped:=true;
         ELSIF code=34 THEN
          scan_in_string:=false;
          IF scan_depth=1 AND convert_from(substring(raw_bytes FROM scan_token_start+1 FOR scan_pos-scan_token_start-1),'UTF8')='metadata' THEN
           probe:=scan_pos+1;
           WHILE probe<=object_end AND get_byte(raw_bytes,probe-1) IN (32,9,10,13) LOOP probe:=probe+1; END LOOP;
           IF probe<=object_end AND get_byte(raw_bytes,probe-1)=58 THEN has_metadata:=true;EXIT;END IF;
          END IF;
         END IF;
        ELSE
         IF code=34 THEN scan_in_string:=true;scan_token_start:=scan_pos;
         ELSIF code=123 THEN scan_depth:=scan_depth+1;
         ELSIF code=125 THEN scan_depth:=scan_depth-1;
         END IF;
        END IF;
       END LOOP;
       IF NOT has_metadata THEN
        prefix:=CASE WHEN object_end=object_start+1 THEN '' ELSE ',' END;
        changed_actions:=changed_actions||substring(raw_bytes FROM copy_from FOR object_end-copy_from)||convert_to(prefix||'"metadata":""','UTF8');
        copy_from:=object_end;
       END IF;
      END IF;
     END IF;
    END IF;
   END IF;
  ELSE
   IF code=34 THEN in_string:=true;token_start:=pos;
   ELSIF code=123 THEN object_depth:=object_depth+1;
   ELSIF code=125 THEN object_depth:=object_depth-1;
   END IF;
  END IF;
  pos:=pos+1;
 END LOOP;
 IF changed_actions=convert_to('','UTF8') THEN RETURN delta_value; END IF;
 changed_actions:=changed_actions||substring(raw_bytes FROM copy_from);
 RETURN convert_from(substring(raw_bytes FROM 1 FOR actions_start-1)||changed_actions,'UTF8');
END
$$;

UPDATE state.operations SET delta=state.action_metadata_delta(delta);

DROP FUNCTION state.action_metadata_delta(text);

-- Preserve identity values, constraints, receipts and indexes while naming the isolation key.
DO $$ DECLARE name text; BEGIN
 FOREACH name IN ARRAY ARRAY['actions','projects','tags','action_tags','perspectives','catalog_identity_ledger','operations'] LOOP
  EXECUTE format('ALTER TABLE state.%I RENAME COLUMN owner TO user_id',name);
  EXECUTE format('DROP POLICY owner_access ON state.%I',name);
  EXECUTE format('CREATE POLICY user_access ON state.%I USING (user_id=current_setting(''app.user_id'',true)) WITH CHECK (user_id=current_setting(''app.user_id'',true))',name);
 END LOOP;
END $$;
ALTER TABLE identity.subjects RENAME COLUMN owner TO user_id;

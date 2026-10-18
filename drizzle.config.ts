import {defineConfig} from 'drizzle-kit';
// Generated drafts are reviewed before promotion into checksummed production migrations.
export default defineConfig({out:'./db/postgres/drafts',schema:'./db/schema.ts',dialect:'postgresql'});

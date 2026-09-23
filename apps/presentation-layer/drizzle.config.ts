import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/shared/db/schema.ts',
  out: './src/shared/db/migrations',
  dialect: 'postgresql',
  // Codebase-first: папки миграций именуются временной меткой (20250920123456_name)
  migrations: {
    prefix: 'timestamp',
  },
  dbCredentials: {
    url: process.env.DATABASE_URL_NEXTJS!,
  },
});

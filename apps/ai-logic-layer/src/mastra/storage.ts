import { PostgresStore } from '@mastra/pg';

export const storage = new PostgresStore({
  id: 'mastra-storage',
  connectionString: process.env.DATABASE_URL_MASTRA,
});

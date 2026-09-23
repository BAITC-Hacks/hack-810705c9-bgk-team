import PgBoss from 'pg-boss';
import { MastraClient } from '@mastra/client-js';
import { S3Client } from '@aws-sdk/client-s3';

const boss = new PgBoss({
  connectionString: process.env.DATABASE_URL_MASTRA,
});

const mastraClient = new MastraClient({
  baseUrl: process.env.MASTRA_API_URL || 'http://localhost:4111',
});

const s3Client = new S3Client({
  endpoint: process.env.RUSTFS_ENDPOINT || 'http://localhost:9000',
  credentials: {
    accessKeyId: process.env.RUSTFS_ACCESS_KEY || 'rustfsadmin',
    secretAccessKey: process.env.RUSTFS_SECRET_KEY || 'rustfsadmin',
  },
  forcePathStyle: true,
});

async function main() {
  await boss.start();
  console.log('pg-boss started');
  console.log('Mastra client ready at:', process.env.MASTRA_API_URL || 'http://localhost:4111');
  console.log('S3 client ready at:', process.env.RUSTFS_ENDPOINT || 'http://localhost:9000');

  await boss.createQueue('example-queue');
  await boss.work('example-queue', async (job) => {
    console.log('Processing job:', job);
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

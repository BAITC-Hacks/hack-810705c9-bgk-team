import { pool } from "../src/shared/db";
import { seedDemoData } from "../src/shared/db/seed";

try {
  if (!process.env.DATABASE_URL_NEXTJS) {
    throw new Error(
      "DATABASE_URL_NEXTJS is required. Load the local environment before running db:seed.",
    );
  }
  const inserted = await seedDemoData();
  console.log(
    `Demo data ready: ${inserted.tasks} new tasks, ${inserted.teams} new teams, ${inserted.proposals} new proposals.`,
  );
} catch (error) {
  // Database errors may contain connection information or submitted data.
  // Keep the CLI output safe while preserving its failure exit status.
  console.error(
    error instanceof Error && error.message.startsWith("DATABASE_URL_NEXTJS")
      ? error.message
      : "Demo seeding failed. Check database availability and apply migrations first.",
  );
  process.exitCode = 1;
} finally {
  await pool.end();
}

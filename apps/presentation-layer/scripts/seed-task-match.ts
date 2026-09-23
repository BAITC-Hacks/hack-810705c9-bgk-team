// Идемпотентный seed ADR-006: команды и задачи с фиксированными id.
// Запуск: DATABASE_URL_NEXTJS=… bun run db:seed:task-match
import { sql } from 'drizzle-orm';
import { db } from '../src/shared/db';
import { tasks, teams } from '../src/shared/db/schema';
import { SEED_TASKS, SEED_TEAMS } from '../src/shared/db/seed/task-match-seed';

async function main() {
  await db
    .insert(teams)
    .values(
      SEED_TEAMS.map((t) => ({
        id: t.id,
        name: t.name,
        roles: t.roles,
        skills: t.skills,
        technologies: t.technologies,
        interests: t.interests,
        lookingFor: t.lookingFor,
      })),
    )
    .onConflictDoUpdate({
      target: teams.id,
      set: {
        name: sql`excluded.name`,
        roles: sql`excluded.roles`,
        skills: sql`excluded.skills`,
        technologies: sql`excluded.technologies`,
        interests: sql`excluded.interests`,
        lookingFor: sql`excluded.looking_for`,
      },
    });

  await db
    .insert(tasks)
    .values(
      SEED_TASKS.map((t) => ({
        id: t.id,
        title: t.title,
        description: t.title,
        company: t.company,
        topic: t.topic,
        status: t.status,
        engagement: t.engagement,
        neededRoles: t.neededRoles,
        neededSkills: t.neededSkills,
        score: t.score,
        publishedAt:
          t.status === 'published'
            ? new Date(t.publishedAt ?? Date.now())
            : null,
      })),
    )
    .onConflictDoUpdate({
      target: tasks.id,
      set: {
        title: sql`excluded.title`,
        company: sql`excluded.company`,
        topic: sql`excluded.topic`,
        status: sql`excluded.status`,
        engagement: sql`excluded.engagement`,
        neededRoles: sql`excluded.needed_roles`,
        neededSkills: sql`excluded.needed_skills`,
        score: sql`excluded.score`,
        publishedAt: sql`excluded.published_at`,
      },
    });

  console.log(`seeded ${SEED_TEAMS.length} teams, ${SEED_TASKS.length} tasks`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

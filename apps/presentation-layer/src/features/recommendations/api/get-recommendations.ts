// ADR-006 п. 2: единый набор рекомендаций для колоды и сетки.
// SQL отбирает кандидатов, fit и порядок FR-5.4 считаются в коде.
import { and, count, eq, gte, inArray, notExists, sql } from 'drizzle-orm';
import { openBlocksOf } from '@/entities/task/model/open-blocks';
import { toTaskTile } from '@/entities/task/model/to-tile';
import type { TeamProfile } from '@/entities/team/model/types';
import { MIN_SCORE, rankRecommendations } from '@/features/recommendations/model/rank';
import type {
  Engagement,
  RecommendationsResponse,
} from '@/shared/api/contracts/task-match';
import { db } from '@/shared/db';
import { swipes, tasks, teams } from '@/shared/db/schema';

/** T-10: practice → practice|both, paid → paid|both, both → все. */
const ALLOWED_ENGAGEMENTS: Record<Engagement, Engagement[]> = {
  practice: ['practice', 'both'],
  paid: ['paid', 'both'],
  both: ['paid', 'practice', 'both'],
};

export async function getRecommendations(
  teamId: string,
): Promise<RecommendationsResponse | null> {
  const [team] = await db.select().from(teams).where(eq(teams.id, teamId));
  if (!team) return null;
  const profile: TeamProfile = team;

  const rows = await db
    .select()
    .from(tasks)
    .where(
      and(
        eq(tasks.status, 'published'),
        gte(tasks.score, MIN_SCORE),
        sql`cardinality(${tasks.neededRoles}) > 0`,
        inArray(tasks.engagement, ALLOWED_ENGAGEMENTS[profile.lookingFor]),
        notExists(
          db
            .select({ one: sql`1` })
            .from(swipes)
            .where(
              and(
                eq(swipes.teamId, teamId),
                eq(swipes.taskId, tasks.id),
                eq(swipes.action, 'skip'),
              ),
            ),
        ),
      ),
    );

  const unknown = await openBlocksOf(rows.map((r) => r.id));
  const candidates = rows.map((r) => toTaskTile(r, unknown.get(r.id) ?? []));
  const items = rankRecommendations(profile, candidates);

  const [{ published }] = await db
    .select({ published: count() })
    .from(tasks)
    .where(eq(tasks.status, 'published'));

  return {
    items,
    catalogRemainder: Math.max(0, published - items.length),
  };
}

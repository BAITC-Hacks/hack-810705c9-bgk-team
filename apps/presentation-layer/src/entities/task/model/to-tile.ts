import type { TaskTile } from '@/shared/api/contracts/task-match';
import type { tasks } from '@/shared/db/schema';
import { levelOf } from './level';

type TaskRow = Pick<
  typeof tasks.$inferSelect,
  | 'id'
  | 'title'
  | 'company'
  | 'topic'
  | 'engagement'
  | 'neededRoles'
  | 'neededSkills'
  | 'score'
  | 'publishedAt'
>;

/** Строка `task` → плитка (FR-5.12, FR-5.15). */
export function toTaskTile(row: TaskRow, unknown: string[] = []): TaskTile {
  return {
    id: row.id,
    title: row.title,
    company: row.company,
    topic: row.topic,
    engagement: row.engagement,
    neededRoles: row.neededRoles,
    neededSkills: row.neededSkills,
    score: row.score,
    level: levelOf(row.score),
    publishedAt: row.publishedAt ? row.publishedAt.toISOString() : null,
    unknown,
  };
}

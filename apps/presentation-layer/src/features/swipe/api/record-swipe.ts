// ADR-006 п. 4: свайпы пишутся только в `swipe`. `task` и рейтинг не меняются (T-11).
import { and, count, eq } from 'drizzle-orm';
import type {
  SwipeRequest,
  SwipeResponse,
} from '@/shared/api/contracts/task-match';
import { conflict, notFound } from '@/shared/api/errors';
import { db } from '@/shared/db';
import { swipes, tasks, teams } from '@/shared/db/schema';

export async function recordSwipe(input: SwipeRequest): Promise<SwipeResponse> {
  const [team] = await db
    .select({ id: teams.id })
    .from(teams)
    .where(eq(teams.id, input.teamId));
  if (!team) throw notFound('Команда не найдена', { teamId: input.teamId });

  const [task] = await db
    .select({ status: tasks.status })
    .from(tasks)
    .where(eq(tasks.id, input.taskId));
  if (!task) throw notFound('Задача не найдена', { taskId: input.taskId });
  if (task.status !== 'published') {
    throw conflict('Свайп возможен только по опубликованной задаче', {
      status: task.status,
    });
  }

  const inserted = await db
    .insert(swipes)
    .values({
      teamId: input.teamId,
      taskId: input.taskId,
      action: input.action,
      block: input.action === 'missing' ? input.block : null,
      note: input.action === 'missing' ? (input.note ?? null) : null,
    })
    .onConflictDoNothing({
      target: [swipes.teamId, swipes.taskId, swipes.action],
    })
    .returning({ id: swipes.id });

  return { ok: true, created: inserted.length > 0 };
}

/** Счётчик «не хватает сведений» по блокам для бизнеса (ADR-006 п. 4). */
export async function getMissingCounts(
  taskId: string,
): Promise<Record<string, number>> {
  const rows = await db
    .select({ block: swipes.block, n: count() })
    .from(swipes)
    .where(and(eq(swipes.taskId, taskId), eq(swipes.action, 'missing')))
    .groupBy(swipes.block);
  return Object.fromEntries(rows.map((r) => [r.block ?? 'other', r.n]));
}

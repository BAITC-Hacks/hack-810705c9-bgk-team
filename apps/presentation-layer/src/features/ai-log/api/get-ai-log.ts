import { desc, eq } from 'drizzle-orm';
import { ApiError } from '@/shared/api/errors';
import { db } from '@/shared/db';
import { aiLogs, tasks } from '@/shared/db/schema';
import { assertTaskOwner, type DemoActor } from '@/shared/lib/demo-actor';

/** AI-14 / ADR-008: only the business that owns the persisted task sees its logs. */
export async function getAiLog(actor: DemoActor, taskId: string) {
  const [task] = await db.select().from(tasks).where(eq(tasks.id, taskId));
  if (!task) throw new ApiError(404, 'not_found', 'Задача не найдена');
  assertTaskOwner(actor, task);
  const entries = await db.select().from(aiLogs)
    .where(eq(aiLogs.taskId, taskId))
    .orderBy(desc(aiLogs.createdAt), desc(aiLogs.id));
  return { entries };
}

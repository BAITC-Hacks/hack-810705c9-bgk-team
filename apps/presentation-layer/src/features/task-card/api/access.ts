import { eq } from 'drizzle-orm';
import { db } from '@/shared/db';
import { tasks } from '@/shared/db/schema';
import { requireDemoActor } from '@/shared/lib/demo-actor.server';
import { assertTaskOwner } from '@/shared/lib/demo-actor';
import { ApiError } from '@/shared/api/errors';
export async function requireTaskOwner(taskId: string) {
 const actor = await requireDemoActor();
 const [task] = await db.select().from(tasks).where(eq(tasks.id, taskId));
 if (!task) throw new ApiError(404, 'not_found', 'Задача не найдена');
 assertTaskOwner(actor, task);
 return { actor, task };
}

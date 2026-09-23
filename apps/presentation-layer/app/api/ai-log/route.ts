import { resourceIdSchema } from "@/shared/api/contracts/resource-id";
import { desc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { requireTaskOwner } from '@/features/task-card/api/access';
import { db } from '@/shared/db';
import { aiLogs } from '@/shared/db/schema';
import { toResponse } from '@/shared/api/errors';
export async function GET(request: Request) {
 try {
  const taskId = resourceIdSchema.parse(new URL(request.url).searchParams.get('taskId'));
  await requireTaskOwner(taskId);
  return Response.json({ entries: await db.select().from(aiLogs).where(eq(aiLogs.taskId, taskId)).orderBy(desc(aiLogs.createdAt)) });
 } catch(error) { return toResponse(error); }
}

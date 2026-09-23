import { getDemoActor } from '@/shared/api/actor';
import { withApi, readJson } from '@/shared/api/errors';
import { resourceIdSchema } from '@/shared/api/contracts/resource-id';
import { jsonOk } from '@/shared/api/handler';
import { updateTaskRequestSchema, updateTaskResponseSchema, readTaskResponseSchema } from '@/shared/api/contracts/tasks';
import { updateTask } from '@/features/task-match/api/tasks';
import { readTask } from '@/features/task-card/api/read-task';

export const PATCH = withApi(async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
  await getDemoActor();
  const id = resourceIdSchema.parse((await params).id);
  const body = updateTaskRequestSchema.parse(await readJson(request));
  return jsonOk(await updateTask(id, body), updateTaskResponseSchema);
});

export const GET = withApi(async (_request: Request, { params }: { params: Promise<{ id: string }> }) => {
  const actor = await getDemoActor();
  const id = resourceIdSchema.parse((await params).id);
  return jsonOk(await readTask(actor, id), readTaskResponseSchema);
});

import { getDemoActor } from '@/shared/api/actor';
import { withApi, readJson } from '@/shared/api/errors';
import { jsonOk } from '@/shared/api/handler';
import { createTaskRequestSchema, createTaskResponseSchema, listTasksResponseSchema } from '@/shared/api/contracts/tasks';
import { createTask, listTasks } from '@/features/task-match/api/tasks';

export const GET = withApi(async (_request: Request) => {
  await getDemoActor();
  return jsonOk(await listTasks(), listTasksResponseSchema);
});

export const POST = withApi(async (request: Request) => {
  await getDemoActor();
  const body = createTaskRequestSchema.parse(await readJson(request));
  return jsonOk(await createTask(body), createTaskResponseSchema, 201);
});

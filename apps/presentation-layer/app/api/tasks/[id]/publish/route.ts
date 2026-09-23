import { getDemoActor } from '@/shared/api/actor';
import { withApi } from '@/shared/api/errors';
import { resourceIdSchema } from '@/shared/api/contracts/resource-id';
import { jsonOk } from '@/shared/api/handler';
import { publishTaskResponseSchema } from '@/shared/api/contracts/tasks';
import { publishTask } from '@/features/task-match/api/tasks';

export const POST = withApi(async (_request: Request, { params }: { params: Promise<{ id: string }> }) => {
  await getDemoActor();
  const id = resourceIdSchema.parse((await params).id);
  return jsonOk(await publishTask(id), publishTaskResponseSchema);
});

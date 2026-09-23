import { getDemoActor } from '@/shared/api/actor';
import { withApi } from '@/shared/api/errors';
import { resourceIdSchema } from '@/shared/api/contracts/resource-id';
import { jsonOk } from '@/shared/api/handler';
import { closeTaskResponseSchema } from '@/shared/api/contracts/tasks';
import { closeTask } from '@/features/close-task';

export const POST = withApi(async (_request: Request, { params }: { params: Promise<{ id: string }> }) => {
  const actor = await getDemoActor();
  const id = resourceIdSchema.parse((await params).id);
  return jsonOk(await closeTask(actor, id), closeTaskResponseSchema);
});

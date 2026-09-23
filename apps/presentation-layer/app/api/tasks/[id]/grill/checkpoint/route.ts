import { getDemoActor } from '@/shared/api/actor';
import { withApi, readJson } from '@/shared/api/errors';
import { resourceIdSchema } from '@/shared/api/contracts/resource-id';
import { jsonOk } from '@/shared/api/handler';
import { grillCheckpointSchema } from '@/shared/api/contracts/grill';
import { taskMutationResponseSchema } from '@/shared/api/contracts/tasks';
import { checkpoint } from '@/features/task-match/api/tasks';

export const POST = withApi(async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
  await getDemoActor();
  const id = resourceIdSchema.parse((await params).id);
  const body = grillCheckpointSchema.parse(await readJson(request));
  return jsonOk(await checkpoint(id, body), taskMutationResponseSchema);
});

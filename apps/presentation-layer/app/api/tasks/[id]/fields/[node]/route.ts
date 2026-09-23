import { getDemoActor } from '@/shared/api/actor';
import { withApi, readJson } from '@/shared/api/errors';
import { resourceIdSchema } from '@/shared/api/contracts/resource-id';
import { jsonOk } from '@/shared/api/handler';
import { editGrillFieldSchema } from '@/shared/api/contracts/grill';
import { taskMutationResponseSchema } from '@/shared/api/contracts/tasks';
import { updateField } from '@/features/task-match/api/tasks';

export const PATCH = withApi(async (request: Request, { params }: { params: Promise<{ id: string; node: string }> }) => {
  await getDemoActor();
  const { id, node } = await params;
  const body = editGrillFieldSchema.parse(await readJson(request));
  return jsonOk(await updateField(resourceIdSchema.parse(id), node, body), taskMutationResponseSchema);
});

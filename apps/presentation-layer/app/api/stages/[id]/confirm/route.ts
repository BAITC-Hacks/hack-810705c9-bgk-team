import { getDemoActor } from '@/shared/api/actor';
import { withApi, readJson } from '@/shared/api/errors';
import { resourceIdSchema } from '@/shared/api/contracts/resource-id';
import { jsonOk } from '@/shared/api/handler';
import { stageConfirmInput } from '@/shared/api/contracts/proposals';
import { stageResponseSchema } from '@/shared/api/contracts/stages';
import { confirmStage } from '@/features/stage-progress';

export const POST = withApi(async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
  const actor = await getDemoActor();
  const id = resourceIdSchema.parse((await params).id);
  const body = stageConfirmInput.parse(await readJson(request));
  return jsonOk(await confirmStage(actor, id, body), stageResponseSchema);
});

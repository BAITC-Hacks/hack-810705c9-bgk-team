import { getDemoActor } from '@/shared/api/actor';
import { withApi, readJson } from '@/shared/api/errors';
import { resourceIdSchema } from '@/shared/api/contracts/resource-id';
import { jsonOk } from '@/shared/api/handler';
import { submitGrillTurnSchema, grillTurnResponseSchema } from '@/shared/api/contracts/grill';
import { answerGrillTurn } from '@/features/task-match/api/tasks';

export const POST = withApi(async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
  await getDemoActor();
  const id = resourceIdSchema.parse((await params).id);
  const body = submitGrillTurnSchema.omit({ classification: true }).parse(await readJson(request));
  return jsonOk(await answerGrillTurn(id, body), grillTurnResponseSchema);
});

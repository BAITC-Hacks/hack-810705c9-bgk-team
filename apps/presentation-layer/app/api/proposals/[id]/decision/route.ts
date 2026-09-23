import { getDemoActor } from '@/shared/api/actor';
import { withApi, readJson } from '@/shared/api/errors';
import { resourceIdSchema } from '@/shared/api/contracts/resource-id';
import { jsonOk } from '@/shared/api/handler';
import { decisionInput, decisionResponseSchema } from '@/shared/api/contracts/proposals';
import { decideProposal } from '@/features/decide-proposal';

export const POST = withApi(async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
  const actor = await getDemoActor();
  const id = resourceIdSchema.parse((await params).id);
  const body = decisionInput.parse(await readJson(request));
  return jsonOk(await decideProposal(actor, id, body), decisionResponseSchema);
});

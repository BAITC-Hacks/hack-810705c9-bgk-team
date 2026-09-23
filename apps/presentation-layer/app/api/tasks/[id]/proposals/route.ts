import { getDemoActor } from '@/shared/api/actor';
import { withApi, readJson } from '@/shared/api/errors';
import { resourceIdSchema } from '@/shared/api/contracts/resource-id';
import { jsonOk } from '@/shared/api/handler';
import { proposalInput, submitProposalResponseSchema, listProposalsResponseSchema } from '@/shared/api/contracts/proposals';
import { submitProposal } from '@/features/submit-proposal';
import { listTaskProposals } from '@/features/decide-proposal';

export const POST = withApi(async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
  const actor = await getDemoActor();
  const id = resourceIdSchema.parse((await params).id);
  const body = proposalInput.parse(await readJson(request));
  return jsonOk(await submitProposal(actor, id, body), submitProposalResponseSchema, 201);
});

export const GET = withApi(async (_request: Request, { params }: { params: Promise<{ id: string }> }) => {
  const actor = await getDemoActor();
  const id = resourceIdSchema.parse((await params).id);
  return jsonOk(await listTaskProposals(actor, id), listProposalsResponseSchema);
});

import { getDemoActor } from '@/shared/api/actor';
import { withApi } from '@/shared/api/errors';
import { resourceIdSchema } from '@/shared/api/contracts/resource-id';
import { jsonOk } from '@/shared/api/handler';
import { kickoffResponseSchema } from '@/shared/api/contracts/proposals';
import { getKickoff } from '@/features/stage-progress';

export const GET = withApi(async (_request: Request, { params }: { params: Promise<{ id: string }> }) => {
  const actor = await getDemoActor();
  const id = resourceIdSchema.parse((await params).id);
  return jsonOk(await getKickoff(actor, id), kickoffResponseSchema);
});

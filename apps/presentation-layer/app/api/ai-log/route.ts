import { getDemoActor } from '@/shared/api/actor';
import { withApi } from '@/shared/api/errors';
import { aiLogQuerySchema, aiLogResponseSchema } from '@/shared/api/contracts/ai-log';
import { jsonOk } from '@/shared/api/handler';
import { getAiLog } from '@/features/ai-log/api/get-ai-log';

export const GET = withApi(async (request: Request) => {
  const actor = await getDemoActor();
  const { taskId } = aiLogQuerySchema.parse(Object.fromEntries(new URL(request.url).searchParams));
  return jsonOk(await getAiLog(actor, taskId), aiLogResponseSchema);
});

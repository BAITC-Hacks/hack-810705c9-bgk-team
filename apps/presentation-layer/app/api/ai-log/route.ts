import type { NextRequest } from 'next/server';

import { aiLogQuerySchema, aiLogResponseSchema } from '@/shared/api/contracts/ai-log';
import { getDemoActor } from '@/shared/api/demo-actor';
import { jsonOk, parseQuery, withErrorHandling } from '@/shared/api/handler';
import { getAiLog } from '@/features/ai-log/api/get-ai-log';

/** GET /api/ai-log?taskId= — раздел 10, AI-14, ADR-008 §4. */
export async function GET(request: NextRequest) {
  return withErrorHandling(async () => {
    const actor = await getDemoActor(request);
    const { taskId } = parseQuery(aiLogQuerySchema, request);
    const result = getAiLog(actor, taskId);
    return jsonOk(aiLogResponseSchema, result);
  });
}

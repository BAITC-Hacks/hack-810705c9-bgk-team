import type { NextRequest } from 'next/server';

import { idParamSchema } from '@/shared/api/contracts/common';
import { getScoreResponseSchema } from '@/shared/api/contracts/tasks';
import { getDemoActor } from '@/shared/api/demo-actor';
import { jsonOk, parseParams, withErrorHandling } from '@/shared/api/handler';
import { getScore } from '@/features/tasks/api/get-score';

/** GET /api/tasks/:id/score — раздел 10, FR-3.3–3.5. */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return withErrorHandling(async () => {
    const actor = await getDemoActor(request);
    const { id } = await parseParams(idParamSchema, params);
    const result = getScore(actor, id);
    return jsonOk(getScoreResponseSchema, result);
  });
}

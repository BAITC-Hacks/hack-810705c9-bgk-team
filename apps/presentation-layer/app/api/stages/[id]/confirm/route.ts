import type { NextRequest } from 'next/server';

import { confirmStageRequestSchema, stageParamsSchema, stageResponseSchema } from '@/shared/api/contracts/stages';
import { getDemoActor } from '@/shared/api/demo-actor';
import { jsonOk, parseBody, parseParams, readJsonBody, withErrorHandling } from '@/shared/api/handler';
import { confirmStage } from '@/features/stages/api/confirm-stage';

/** POST /api/stages/:id/confirm — раздел 10, ADR-007 §5 (FR-8.3, FR-8.4). */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return withErrorHandling(async () => {
    const actor = await getDemoActor(request);
    const { id } = await parseParams(stageParamsSchema, params);
    const body = parseBody(confirmStageRequestSchema, await readJsonBody(request));
    const result = await confirmStage(actor, id, body);
    return jsonOk(stageResponseSchema, result);
  });
}

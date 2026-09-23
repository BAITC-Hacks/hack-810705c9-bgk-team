import type { NextRequest } from 'next/server';

import { returnStageRequestSchema, stageParamsSchema, stageResponseSchema } from '@/shared/api/contracts/stages';
import { getDemoActor } from '@/shared/api/demo-actor';
import { jsonOk, parseBody, parseParams, readJsonBody, withErrorHandling } from '@/shared/api/handler';
import { returnStage } from '@/features/stages/api/return-stage';

/** POST /api/stages/:id/return — раздел 10, ADR-007 §5 (FR-8.3). */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return withErrorHandling(async () => {
    const actor = await getDemoActor(request);
    const { id } = await parseParams(stageParamsSchema, params);
    const body = parseBody(returnStageRequestSchema, await readJsonBody(request));
    const result = await returnStage(actor, id, body);
    return jsonOk(stageResponseSchema, result);
  });
}

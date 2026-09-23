import type { NextRequest } from 'next/server';

import { stageParamsSchema } from '@/shared/api/contracts/stages';
import { claimStageRequestSchema, stageResponseSchema } from '@/shared/api/contracts/stages';
import { getDemoActor } from '@/shared/api/demo-actor';
import { jsonOk, parseBody, parseParams, readJsonBody, withErrorHandling } from '@/shared/api/handler';
import { claimStage } from '@/features/stages/api/claim-stage';

/** POST /api/stages/:id/claim — раздел 10, ADR-007 §5 (FR-8.2). */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return withErrorHandling(async () => {
    const actor = await getDemoActor(request);
    const { id } = await parseParams(stageParamsSchema, params);
    const body = parseBody(claimStageRequestSchema, await readJsonBody(request));
    const result = await claimStage(actor, id, body);
    return jsonOk(stageResponseSchema, result);
  });
}

import type { NextRequest } from 'next/server';

import { idParamSchema } from '@/shared/api/contracts/common';
import { grillTurnRequestSchema, grillTurnResponseSchema } from '@/shared/api/contracts/grill';
import { getDemoActor } from '@/shared/api/demo-actor';
import { jsonOk, parseBody, parseParams, readJsonBody, withErrorHandling } from '@/shared/api/handler';
import { submitGrillTurn } from '@/features/grill/api/submit-turn';

/** POST /api/tasks/:id/grill/turn — раздел 10, ADR-009 §6, ADR-004 §6. */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return withErrorHandling(async () => {
    const actor = await getDemoActor(request);
    const { id } = await parseParams(idParamSchema, params);
    const body = parseBody(grillTurnRequestSchema, await readJsonBody(request));
    const result = await submitGrillTurn(actor, id, body);
    return jsonOk(grillTurnResponseSchema, result);
  });
}

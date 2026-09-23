import type { NextRequest } from 'next/server';

import { idParamSchema } from '@/shared/api/contracts/common';
import { kickoffResponseSchema } from '@/shared/api/contracts/proposals';
import { getDemoActor } from '@/shared/api/demo-actor';
import { jsonOk, parseParams, withErrorHandling } from '@/shared/api/handler';
import { getKickoff } from '@/features/proposals/api/get-kickoff';

/** GET /api/proposals/:id/kickoff — раздел 10, FR-7.9. */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return withErrorHandling(async () => {
    const actor = await getDemoActor(request);
    const { id } = await parseParams(idParamSchema, params);
    const result = getKickoff(actor, id);
    return jsonOk(kickoffResponseSchema, result);
  });
}

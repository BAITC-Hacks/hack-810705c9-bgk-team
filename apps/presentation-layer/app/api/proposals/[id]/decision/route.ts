import type { NextRequest } from 'next/server';

import { idParamSchema } from '@/shared/api/contracts/common';
import { decisionRequestSchema, decisionResponseSchema } from '@/shared/api/contracts/proposals';
import { getDemoActor } from '@/shared/api/demo-actor';
import { jsonOk, parseBody, parseParams, readJsonBody, withErrorHandling } from '@/shared/api/handler';
import { decideProposal } from '@/features/proposals/api/decide-proposal';

/** POST /api/proposals/:id/decision — раздел 10, ADR-007 §3 (FR-7.5, T-16). */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return withErrorHandling(async () => {
    const actor = await getDemoActor(request);
    const { id } = await parseParams(idParamSchema, params);
    const body = parseBody(decisionRequestSchema, await readJsonBody(request));
    const result = await decideProposal(actor, id, body);
    return jsonOk(decisionResponseSchema, result);
  });
}

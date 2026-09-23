import type { NextRequest } from 'next/server';

import { idParamSchema } from '@/shared/api/contracts/common';
import {
  listProposalsResponseSchema,
  submitProposalRequestSchema,
  submitProposalResponseSchema,
} from '@/shared/api/contracts/proposals';
import { getDemoActor } from '@/shared/api/demo-actor';
import { jsonOk, parseBody, parseParams, readJsonBody, withErrorHandling } from '@/shared/api/handler';
import { listProposals } from '@/features/proposals/api/list-proposals';
import { submitProposal } from '@/features/proposals/api/submit-proposal';

/** POST /api/tasks/:id/proposals — раздел 10, ADR-007 §2 (FR-6.1, FR-6.4). */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return withErrorHandling(async () => {
    const actor = await getDemoActor(request);
    const { id } = await parseParams(idParamSchema, params);
    const body = parseBody(submitProposalRequestSchema, await readJsonBody(request));
    const result = await submitProposal(actor, id, body);
    return jsonOk(submitProposalResponseSchema, result, { status: 201 });
  });
}

/** GET /api/tasks/:id/proposals — раздел 10, ADR-007 §7 (FR-7.1, FR-7.2). */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return withErrorHandling(async () => {
    const actor = await getDemoActor(request);
    const { id } = await parseParams(idParamSchema, params);
    const result = listProposals(actor, id);
    return jsonOk(listProposalsResponseSchema, result);
  });
}

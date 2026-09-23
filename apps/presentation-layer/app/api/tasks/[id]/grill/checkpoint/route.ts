import type { NextRequest } from 'next/server';

import { idParamSchema } from '@/shared/api/contracts/common';
import {
  grillCheckpointRequestSchema,
  grillCheckpointResponseSchema,
} from '@/shared/api/contracts/grill';
import { getDemoActor } from '@/shared/api/demo-actor';
import { jsonOk, parseBody, parseParams, readJsonBody, withErrorHandling } from '@/shared/api/handler';
import { submitGrillCheckpoint } from '@/features/grill/api/submit-checkpoint';

/** POST /api/tasks/:id/grill/checkpoint — раздел 10, ADR-004 §4 (FR-1.9). */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return withErrorHandling(async () => {
    const actor = await getDemoActor(request);
    const { id } = await parseParams(idParamSchema, params);
    const body = parseBody(grillCheckpointRequestSchema, await readJsonBody(request));
    const result = await submitGrillCheckpoint(actor, id, body);
    return jsonOk(grillCheckpointResponseSchema, result);
  });
}

import type { NextRequest } from 'next/server';

import { patchFieldParamsSchema, patchFieldRequestSchema, patchFieldResponseSchema } from '@/shared/api/contracts/fields';
import { getDemoActor } from '@/shared/api/demo-actor';
import { jsonOk, parseBody, parseParams, readJsonBody, withErrorHandling } from '@/shared/api/handler';
import { patchField } from '@/features/tasks/api/patch-field';

/** PATCH /api/tasks/:id/fields/:node — раздел 10, ADR-004 §5 / ADR-009 §6 (FR-2.3, T-6). */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; node: string }> },
) {
  return withErrorHandling(async () => {
    const actor = await getDemoActor(request);
    const { id, node } = await parseParams(patchFieldParamsSchema, params);
    const body = parseBody(patchFieldRequestSchema, await readJsonBody(request));
    const result = await patchField(actor, id, node, body);
    return jsonOk(patchFieldResponseSchema, result);
  });
}

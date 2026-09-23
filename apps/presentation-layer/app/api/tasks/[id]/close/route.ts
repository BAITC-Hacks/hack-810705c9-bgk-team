import type { NextRequest } from 'next/server';

import { idParamSchema } from '@/shared/api/contracts/common';
import { closeTaskResponseSchema } from '@/shared/api/contracts/tasks';
import { getDemoActor } from '@/shared/api/demo-actor';
import { jsonOk, parseParams, withErrorHandling } from '@/shared/api/handler';
import { closeTask } from '@/features/tasks/api/close-task';

/** POST /api/tasks/:id/close — раздел 10, ADR-007 §4 (T-17). */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return withErrorHandling(async () => {
    const actor = await getDemoActor(request);
    const { id } = await parseParams(idParamSchema, params);
    const result = await closeTask(actor, id);
    return jsonOk(closeTaskResponseSchema, result);
  });
}

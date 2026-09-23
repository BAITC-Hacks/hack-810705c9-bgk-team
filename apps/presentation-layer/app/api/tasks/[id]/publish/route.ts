import type { NextRequest } from 'next/server';

import { idParamSchema } from '@/shared/api/contracts/common';
import { publishTaskResponseSchema } from '@/shared/api/contracts/tasks';
import { getDemoActor } from '@/shared/api/demo-actor';
import { jsonOk, parseParams, withErrorHandling } from '@/shared/api/handler';
import { publishTask } from '@/features/tasks/api/publish-task';

/** POST /api/tasks/:id/publish — раздел 10, FR-4.1/FR-4.2. */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return withErrorHandling(async () => {
    const actor = await getDemoActor(request);
    const { id } = await parseParams(idParamSchema, params);
    const result = await publishTask(actor, id);
    return jsonOk(publishTaskResponseSchema, result);
  });
}

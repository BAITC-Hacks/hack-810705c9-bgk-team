import type { NextRequest } from 'next/server';

import { idParamSchema } from '@/shared/api/contracts/common';
import { updateTaskRequestSchema, updateTaskResponseSchema } from '@/shared/api/contracts/tasks';
import { getDemoActor } from '@/shared/api/demo-actor';
import { jsonOk, parseBody, parseParams, readJsonBody, withErrorHandling } from '@/shared/api/handler';
import { updateTask } from '@/features/tasks/api/update-task';

/** PATCH /api/tasks/:id — ADR-009 §6 (формат, оплата, теги), FR-1.1/FR-2.7/T-7. */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return withErrorHandling(async () => {
    const actor = await getDemoActor(request);
    const { id } = await parseParams(idParamSchema, params);
    const body = parseBody(updateTaskRequestSchema, await readJsonBody(request));
    const result = await updateTask(actor, id, body);
    return jsonOk(updateTaskResponseSchema, result);
  });
}

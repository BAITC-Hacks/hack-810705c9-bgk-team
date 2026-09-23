import type { NextRequest } from 'next/server';

import { createTaskRequestSchema, createTaskResponseSchema } from '@/shared/api/contracts/tasks';
import { getDemoActor } from '@/shared/api/demo-actor';
import { jsonOk, parseBody, readJsonBody, withErrorHandling } from '@/shared/api/handler';
import { createTask } from '@/features/tasks/api/create-task';

/** POST /api/tasks — раздел 10 ТЗ, FR-1.1, ADR-009 §6. */
export async function POST(request: NextRequest) {
  return withErrorHandling(async () => {
    const actor = await getDemoActor(request);
    const body = parseBody(createTaskRequestSchema, await readJsonBody(request));
    const result = await createTask(actor, body);
    return jsonOk(createTaskResponseSchema, result, { status: 201 });
  });
}

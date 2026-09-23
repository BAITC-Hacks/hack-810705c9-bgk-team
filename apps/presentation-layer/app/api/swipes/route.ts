import type { NextRequest } from 'next/server';

import { createSwipeRequestSchema, createSwipeResponseSchema } from '@/shared/api/contracts/swipes';
import { getDemoActor } from '@/shared/api/demo-actor';
import { jsonOk, parseBody, readJsonBody, withErrorHandling } from '@/shared/api/handler';
import { createSwipe } from '@/features/swipes/api/create-swipe';

/** POST /api/swipes — раздел 10, ADR-006 §4 (FR-5.6, FR-5.8). */
export async function POST(request: NextRequest) {
  return withErrorHandling(async () => {
    const actor = await getDemoActor(request);
    const body = parseBody(createSwipeRequestSchema, await readJsonBody(request));
    const result = await createSwipe(actor, body);
    return jsonOk(createSwipeResponseSchema, result, { status: 201 });
  });
}

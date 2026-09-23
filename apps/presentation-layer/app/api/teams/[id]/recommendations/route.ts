import type { NextRequest } from 'next/server';

import { recommendationsParamsSchema, recommendationsResponseSchema } from '@/shared/api/contracts/recommendations';
import { jsonOk, parseParams, withErrorHandling } from '@/shared/api/handler';
import { getRecommendations } from '@/features/recommendations/api/get-recommendations';

/** GET /api/teams/:id/recommendations — раздел 10, ADR-006 §2 (FR-5.3, FR-5.4). */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return withErrorHandling(async () => {
    const { id } = await parseParams(recommendationsParamsSchema, params);
    const result = getRecommendations(id);
    return jsonOk(recommendationsResponseSchema, result);
  });
}

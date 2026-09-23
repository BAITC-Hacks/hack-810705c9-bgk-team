import type { NextRequest } from 'next/server';

import { catalogQuerySchema, catalogResponseSchema } from '@/shared/api/contracts/catalog';
import { jsonOk, parseQuery, withErrorHandling } from '@/shared/api/handler';
import { getCatalog } from '@/features/catalog/api/get-catalog';

/** GET /api/catalog?topic=&level=&role=&format= — раздел 10, ADR-006 §5. */
export async function GET(request: NextRequest) {
  return withErrorHandling(async () => {
    const query = parseQuery(catalogQuerySchema, request);
    const result = getCatalog(query);
    return jsonOk(catalogResponseSchema, result);
  });
}

import { getCatalog } from '@/features/catalog/api/get-catalog';
import { catalogQuerySchema } from '@/shared/api/contracts/task-match';
import { toErrorResponse } from '@/shared/api/errors';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const query = Object.fromEntries(new URL(req.url).searchParams);
    const filters = catalogQuerySchema.parse(query);
    return Response.json(await getCatalog(filters));
  } catch (e) {
    return toErrorResponse(e);
  }
}

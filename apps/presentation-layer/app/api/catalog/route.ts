import { getCatalog } from '@/features/catalog/api/get-catalog';
import { catalogQuerySchema, catalogResponseSchema } from '@/shared/api/contracts/task-match';
import { withApi } from '@/shared/api/errors';
import { jsonOk } from '@/shared/api/handler';

export const dynamic = 'force-dynamic';
export const GET = withApi(async (request: Request) => {
  const query = catalogQuerySchema.parse(Object.fromEntries(new URL(request.url).searchParams));
  return jsonOk(await getCatalog(query), catalogResponseSchema);
});

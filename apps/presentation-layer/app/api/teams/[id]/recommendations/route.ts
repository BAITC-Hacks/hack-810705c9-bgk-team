import { getRecommendations } from '@/features/recommendations/api/get-recommendations';
import { teamIdParamSchema, recommendationsResponseSchema } from '@/shared/api/contracts/task-match';
import { notFound, withApi } from '@/shared/api/errors';
import { jsonOk } from '@/shared/api/handler';

export const dynamic = 'force-dynamic';
export const GET = withApi(async (_request: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = teamIdParamSchema.parse(await params);
  const result = await getRecommendations(id);
  if (!result) throw notFound('Команда не найдена', { teamId: id });
  return jsonOk(result, recommendationsResponseSchema);
});

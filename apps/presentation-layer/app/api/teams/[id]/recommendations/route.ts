import { getRecommendations } from '@/features/recommendations/api/get-recommendations';
import { teamIdParamSchema } from '@/shared/api/contracts/task-match';
import { notFound, toErrorResponse } from '@/shared/api/errors';

export const dynamic = 'force-dynamic';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = teamIdParamSchema.parse(await params);
    const result = await getRecommendations(id);
    if (!result) throw notFound('Команда не найдена', { teamId: id });
    return Response.json(result);
  } catch (e) {
    return toErrorResponse(e);
  }
}

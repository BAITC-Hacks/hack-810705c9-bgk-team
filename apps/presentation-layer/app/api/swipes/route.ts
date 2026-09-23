import { recordSwipe } from '@/features/swipe';
import { swipeRequestSchema, swipeResponseSchema } from '@/shared/api/contracts/task-match';
import { withApi, readJson } from '@/shared/api/errors';
import { jsonOk } from '@/shared/api/handler';

export const dynamic = 'force-dynamic';
export const POST = withApi(async (request: Request) => {
  const input = swipeRequestSchema.parse(await readJson(request));
  const result = await recordSwipe(input);
  return jsonOk(result, swipeResponseSchema, result.created ? 201 : 200);
});

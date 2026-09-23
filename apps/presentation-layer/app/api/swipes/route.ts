import { recordSwipe } from '@/features/swipe';
import { swipeRequestSchema } from '@/shared/api/contracts/task-match';
import { toErrorResponse, readJson, assertSameOrigin } from '@/shared/api/errors';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
    const input = swipeRequestSchema.parse(await readJson(req));
    const result = await recordSwipe(input);
    return Response.json(result, { status: result.created ? 201 : 200 });
  } catch (e) {
    return toErrorResponse(e);
  }
}

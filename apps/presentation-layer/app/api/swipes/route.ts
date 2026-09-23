import { recordSwipe } from '@/features/swipe';
import { swipeRequestSchema } from '@/shared/api/contracts/task-match';
import { toErrorResponse } from '@/shared/api/errors';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const input = swipeRequestSchema.parse(await req.json());
    const result = await recordSwipe(input);
    return Response.json(result, { status: result.created ? 201 : 200 });
  } catch (e) {
    return toErrorResponse(e);
  }
}

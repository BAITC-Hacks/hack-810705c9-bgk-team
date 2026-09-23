import { grillCheckpointSchema } from '@/shared/api/contracts/grill';
import { apiError, readJson } from '@/shared/api/route-response';
import { checkpoint } from '@/features/grill/api/service';

type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Context) {
  try {
    const input = grillCheckpointSchema.parse(await readJson(request));
    return Response.json(await checkpoint((await params).id, input));
  } catch (error) { return apiError(error); }
}

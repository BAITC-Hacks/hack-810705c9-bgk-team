import { submitGrillTurnSchema } from '@/shared/api/contracts/grill';
import { apiError, readJson } from '@/shared/api/route-response';
import { submitTurn } from '@/features/grill/api/service';

type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Context) {
  try {
    const input = submitGrillTurnSchema.parse(await readJson(request));
    return Response.json(await submitTurn((await params).id, input));
  } catch (error) { return apiError(error); }
}

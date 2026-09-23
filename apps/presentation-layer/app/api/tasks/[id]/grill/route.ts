import { apiError, readJson } from '@/shared/api/route-response';
import { createGrillSchema } from '@/shared/api/contracts/grill';
import { createGrill, getGrill } from '@/features/grill/api/service';

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Context) {
  try { return Response.json(await getGrill((await params).id)); }
  catch (error) { return apiError(error); }
}

export async function POST(request: Request, { params }: Context) {
  try {
    const input = createGrillSchema.parse(await readJson(request));
    return Response.json(await createGrill((await params).id, input), { status: 201 });
  } catch (error) { return apiError(error); }
}

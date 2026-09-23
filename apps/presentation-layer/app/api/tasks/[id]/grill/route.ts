import { apiError } from '@/shared/api/route-response';
import { getGrill } from '@/features/grill/api/service';

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Context) {
  try { return Response.json(await getGrill((await params).id)); }
  catch (error) { return apiError(error); }
}

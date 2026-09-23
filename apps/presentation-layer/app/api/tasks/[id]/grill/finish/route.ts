import { z } from 'zod';
import { apiError, readJson } from '@/shared/api/route-response';
import { finishGrill } from '@/features/grill/api/service';

const finishSchema = z.object({ sessionVersion: z.number().int().nonnegative() });
type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Context) {
  try {
    const input = finishSchema.parse(await readJson(request));
    return Response.json(await finishGrill((await params).id, input.sessionVersion));
  } catch (error) { return apiError(error); }
}

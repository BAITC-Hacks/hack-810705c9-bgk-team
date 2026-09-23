import { editGrillFieldSchema } from '@/shared/api/contracts/grill';
import { apiError, readJson } from '@/shared/api/route-response';
import { patchField } from '@/features/grill/api/service';

type Context = { params: Promise<{ id: string; node: string }> };

export async function PATCH(request: Request, { params }: Context) {
  try {
    const input = editGrillFieldSchema.parse(await readJson(request));
    const { id, node } = await params;
    return Response.json(await patchField(id, node, input));
  } catch (error) { return apiError(error); }
}

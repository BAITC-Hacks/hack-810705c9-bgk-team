import {
  claimInputSchema,
  claimStage,
  demoAccessRepository,
  readBody,
  toErrorResponse,
} from "@/features/demo-access";
import { getDemoActor } from "@/shared/lib/demo-actor.server";

// ADR-008 п. 2: сдать этап может только команда — автор отклика.
export async function POST(request: Request, ctx: RouteContext<"/api/stages/[id]/claim">) {
  try {
    const actor = await getDemoActor();
    const { id } = await ctx.params;
    const input = await readBody(request, claimInputSchema);
    const stage = await claimStage(actor, id, input, demoAccessRepository);
    return Response.json({ stage });
  } catch (error) {
    return toErrorResponse(error);
  }
}

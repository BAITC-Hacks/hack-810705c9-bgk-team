import { claimStage, demoAccessRepository, readBody, toErrorResponse } from "@/features/demo-access";
import { requireDemoActor } from "@/shared/lib/demo-actor.server";

// ADR-008 п. 2: сдать этап может только команда — автор отклика.
export async function POST(request: Request, ctx: RouteContext<"/api/stages/[id]/claim">) {
  try {
    const actor = await requireDemoActor();
    const { id } = await ctx.params;
    const stage = await claimStage(actor, id, await readBody(request), demoAccessRepository);
    return Response.json({ stage });
  } catch (error) {
    return toErrorResponse(error);
  }
}

import { returnStage, demoAccessRepository, readBody, toErrorResponse } from "@/features/demo-access";
import { requireDemoActor } from "@/shared/lib/demo-actor.server";

// ADR-008 п. 2: вернуть этап на доработку может только бизнес-владелец задачи.
export async function POST(request: Request, ctx: RouteContext<"/api/stages/[id]/return">) {
  try {
    const actor = await requireDemoActor();
    const { id } = await ctx.params;
    const stage = await returnStage(actor, id, await readBody(request), demoAccessRepository);
    return Response.json({ stage });
  } catch (error) {
    return toErrorResponse(error);
  }
}

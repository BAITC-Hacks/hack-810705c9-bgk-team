import { confirmStage, demoAccessRepository, readBody, toErrorResponse } from "@/features/demo-access";
import { requireDemoActor } from "@/shared/lib/demo-actor.server";

// ADR-008 п. 2: подтвердить этап может только бизнес-владелец задачи.
export async function POST(request: Request, ctx: RouteContext<"/api/stages/[id]/confirm">) {
  try {
    const actor = await requireDemoActor();
    const { id } = await ctx.params;
    const stage = await confirmStage(actor, id, await readBody(request), demoAccessRepository);
    return Response.json({ stage });
  } catch (error) {
    return toErrorResponse(error);
  }
}

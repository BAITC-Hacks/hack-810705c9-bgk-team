import { decideProposal, demoAccessRepository, readBody, toErrorResponse } from "@/features/demo-access";
import { requireDemoActor } from "@/shared/lib/demo-actor.server";

// ADR-008 п. 2: решение по отклику принимает только бизнес-владелец задачи.
export async function POST(request: Request, ctx: RouteContext<"/api/proposals/[id]/decision">) {
  try {
    const actor = await requireDemoActor();
    const { id } = await ctx.params;
    const proposal = await decideProposal(actor, id, await readBody(request), demoAccessRepository);
    return Response.json({ proposal });
  } catch (error) {
    return toErrorResponse(error);
  }
}

import {
  decideProposal,
  decisionInputSchema,
  demoAccessRepository,
  readBody,
  toErrorResponse,
} from "@/features/demo-access";
import { getDemoActor } from "@/shared/lib/demo-actor.server";

// ADR-008 п. 2: решение по отклику принимает только бизнес-владелец задачи.
export async function POST(request: Request, ctx: RouteContext<"/api/proposals/[id]/decision">) {
  try {
    const actor = await getDemoActor();
    const { id } = await ctx.params;
    const input = await readBody(request, decisionInputSchema);
    const proposal = await decideProposal(actor, id, input, demoAccessRepository);
    return Response.json({ proposal });
  } catch (error) {
    return toErrorResponse(error);
  }
}

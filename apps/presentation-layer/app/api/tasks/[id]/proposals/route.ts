import { apiRoute, jsonBody } from "@/server/workspace/http";
import { applyToTask, listProposals } from "@/server/workspace/service";
import { idSchema, proposalInputSchema } from "@/entities/workspace/contracts";
export const runtime = "nodejs";
export const GET = apiRoute(async (_request, context, session) =>
  listProposals(idSchema.parse((await context.params).id), session),
);
export const POST = apiRoute(
  async (request, context, session) =>
    applyToTask(
      idSchema.parse((await context.params).id),
      await jsonBody(request, proposalInputSchema),
      session,
    ),
  201,
);

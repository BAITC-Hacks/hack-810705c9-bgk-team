import { apiRoute, jsonBody } from "@/server/workspace/http";
import { decideProposal } from "@/server/workspace/service";
import { idSchema, decisionSchema } from "@/entities/workspace/contracts";
export const runtime = "nodejs";
export const POST = apiRoute(async (request, context, session) =>
  decideProposal(
    idSchema.parse((await context.params).id),
    (await jsonBody(request, decisionSchema)).status,
    session,
  ),
);

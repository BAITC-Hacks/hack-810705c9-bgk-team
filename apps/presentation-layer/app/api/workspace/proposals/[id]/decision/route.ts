import { apiRoute, jsonBody } from "@/server/workspace/http";
import { decideProposal } from "@/server/workspace/service";
import { decisionSchema, idSchema } from "@/entities/workspace/contracts";
export const runtime = "nodejs";
export const POST = apiRoute(async (request, context, session) => {
  const input = await jsonBody(request, decisionSchema);
  return decideProposal(idSchema.parse((await context.params).id), input.status, session, input.note);
});

import { apiRoute, jsonBody } from "@/server/workspace/http";
import { submitResult } from "@/server/workspace/service";
import { idSchema, milestoneInputSchema } from "@/entities/workspace/contracts";
export const runtime = "nodejs";
export const PUT = apiRoute(async (request, context, session) =>
  submitResult(
    idSchema.parse((await context.params).id),
    await jsonBody(request, milestoneInputSchema),
    session,
  ),
);

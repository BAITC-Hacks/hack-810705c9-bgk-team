import { apiRoute } from "@/server/workspace/http";
import { getScore } from "@/server/workspace/service";
import { idSchema } from "@/entities/workspace/contracts";
export const runtime = "nodejs";
export const GET = apiRoute(async (_request, context, session) =>
  getScore(idSchema.parse((await context.params).id), session),
);

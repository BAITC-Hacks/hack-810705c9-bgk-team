import { apiRoute } from "@/server/workspace/http";
import { getProgress } from "@/server/workspace/service";
import { idSchema } from "@/entities/workspace/contracts";
export const runtime = "nodejs";
export const GET = apiRoute(async (_request, context, session) =>
  getProgress(idSchema.parse((await context.params).id), session),
);

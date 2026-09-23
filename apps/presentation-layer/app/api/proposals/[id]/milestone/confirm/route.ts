import { apiRoute } from "@/server/workspace/http";
import { confirmResult } from "@/server/workspace/service";
import { idSchema } from "@/entities/workspace/contracts";
export const runtime = "nodejs";
export const POST = apiRoute(async (_request, context, session) =>
  confirmResult(idSchema.parse((await context.params).id), session),
);

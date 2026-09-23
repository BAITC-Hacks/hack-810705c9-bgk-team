import { apiRoute, jsonBody } from "@/server/workspace/http";
import { getTask, updateTask } from "@/server/workspace/service";
import { idSchema, taskUpdateSchema } from "@/entities/workspace/contracts";
export const runtime = "nodejs";
export const GET = apiRoute(async (_request, context, session) =>
  getTask(idSchema.parse((await context.params).id), session),
);
export const PATCH = apiRoute(async (request, context, session) =>
  updateTask(
    idSchema.parse((await context.params).id),
    await jsonBody(request, taskUpdateSchema),
    session,
  ),
);

import { apiRoute, jsonBody } from "@/server/workspace/http";
import { addTask } from "@/server/workspace/service";
import { taskCreateSchema } from "@/entities/workspace/contracts";
export const runtime = "nodejs";
export const POST = apiRoute(async (request, _context, session) => {
  const input = await jsonBody(request, taskCreateSchema);
  return addTask(input.description, session);
}, 201);

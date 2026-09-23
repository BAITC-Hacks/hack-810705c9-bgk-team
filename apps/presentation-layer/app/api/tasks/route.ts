import { apiRoute, jsonBody } from "@/server/workspace/http";
import { addTask, getWorkspace } from "@/server/workspace/service";
import { taskCreateSchema } from "@/entities/workspace/contracts";
export const runtime = "nodejs";
export const GET = apiRoute(
  async (_request, _context, session) => (await getWorkspace(session)).tasks,
);
export const POST = apiRoute(
  async (request, _context, session) =>
    addTask((await jsonBody(request, taskCreateSchema)).description, session),
  201,
);

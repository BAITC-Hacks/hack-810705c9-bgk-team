import { apiRoute, jsonBody } from "@/server/workspace/http";
import { saveTeam, getWorkspace } from "@/server/workspace/service";
import { teamInputSchema } from "@/entities/workspace/contracts";
export const runtime = "nodejs";
export const GET = apiRoute(
  async (_request, _context, session) => (await getWorkspace(session)).teams,
);
export const POST = apiRoute(
  async (request, _context, session) =>
    saveTeam(await jsonBody(request, teamInputSchema), session),
  201,
);

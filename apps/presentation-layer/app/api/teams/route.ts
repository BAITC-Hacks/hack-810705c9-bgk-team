import { apiRoute, jsonBody } from "@/server/workspace/http";
import { saveTeam, listTeams } from "@/server/workspace/service";
import { teamInputSchema } from "@/entities/workspace/contracts";
export const runtime = "nodejs";
export const GET = apiRoute(async () => listTeams());
export const POST = apiRoute(
  async (request, _context, session) =>
    saveTeam(await jsonBody(request, teamInputSchema), session),
  201,
);

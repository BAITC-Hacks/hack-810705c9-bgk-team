import { apiRoute, jsonBody, setSessionCookie } from "@/server/workspace/http";
import { validateSessionTeam } from "@/server/workspace/service";
import { sessionUpdateSchema } from "@/entities/workspace/contracts";
export const runtime = "nodejs";
export const GET = apiRoute(async (_request, _context, session) => session);
export const PATCH = apiRoute(async (request, _context, session) => {
  const input = await jsonBody(request, sessionUpdateSchema);
  if (input.teamId) await validateSessionTeam(input.teamId);
  const next = { ...session, ...input };
  await setSessionCookie(next);
  return next;
});

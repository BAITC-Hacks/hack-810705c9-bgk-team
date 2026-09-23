import { apiRoute } from "@/server/workspace/http";
import { getWorkspace } from "@/server/workspace/service";
export const runtime = "nodejs";
export const GET = apiRoute((_request, _context, session) =>
  getWorkspace(session),
);

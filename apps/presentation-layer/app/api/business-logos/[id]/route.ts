import { getBusinessLogo } from "@/server/workspace/business-logos";
import { apiRoute } from "@/server/workspace/http";

export const runtime = "nodejs";
export const GET = apiRoute(async (_request, context) =>
  getBusinessLogo((await context.params).id),
);

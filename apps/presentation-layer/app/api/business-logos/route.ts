import { uploadBusinessLogo } from "@/server/workspace/business-logos";
import { apiRoute } from "@/server/workspace/http";

export const runtime = "nodejs";
export const POST = apiRoute(
  async (request) => uploadBusinessLogo(request),
  201,
);

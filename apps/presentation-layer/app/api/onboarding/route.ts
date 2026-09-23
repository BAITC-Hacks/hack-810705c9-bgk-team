import { onboardingSchema } from "@/entities/workspace/contracts";
import { apiRoute, jsonBody, setSessionCookie } from "@/server/workspace/http";
import { completeOnboarding } from "@/server/workspace/service";

export const runtime = "nodejs";

export const POST = apiRoute(async (request, _context, session) => {
  const next = await completeOnboarding(await jsonBody(request, onboardingSchema), session);
  await setSessionCookie(next);
  return next;
});

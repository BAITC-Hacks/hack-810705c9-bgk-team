import { apiRoute, jsonBody } from "@/server/workspace/http";
import { saveTeam } from "@/server/workspace/service";
import { idSchema, teamInputSchema } from "@/entities/workspace/contracts";
import { ApiError } from "@/shared/api/errors";
export const runtime = "nodejs";
export const PATCH = apiRoute(async (request, context, session) => {
  const id = idSchema.parse((await context.params).id);
  const input = await jsonBody(request, teamInputSchema);
  if (id !== input.id)
    throw new ApiError(
      422,
      "ID_MISMATCH",
      "Идентификатор команды не совпадает.",
    );
  return saveTeam(input, session, true);
});

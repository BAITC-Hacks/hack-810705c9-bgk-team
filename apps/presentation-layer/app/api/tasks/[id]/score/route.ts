import { getScore } from "@/features/task-card";
import { taskScoreParamsSchema, taskScoreResponseSchema } from "@/shared/api/contracts/score";
import { apiError } from "@/shared/api/errors";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  // TODO(ADR-008): getDemoActor() и проверка роли/владельца.
  const parsed = taskScoreParamsSchema.safeParse(await params);
  if (!parsed.success) {
    return apiError(422, "invalid_params", "Некорректный идентификатор задачи", parsed.error.issues);
  }

  const result = await getScore(parsed.data.id);
  if (!result) return apiError(404, "task_not_found", "Задача не найдена");

  return Response.json(taskScoreResponseSchema.parse(result));
}

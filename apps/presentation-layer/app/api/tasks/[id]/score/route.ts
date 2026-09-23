import { getScore } from "@/features/task-card";
import { taskScoreParamsSchema, taskScoreResponseSchema } from "@/shared/api/contracts/score";
import { requireTaskOwner } from '@/features/task-card/api/access';
import { toResponse } from '@/shared/api/errors';
import { apiError } from "@/shared/api/errors";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
  const parsed = taskScoreParamsSchema.safeParse(await params);
  if (!parsed.success) {
    return apiError(422, "invalid_params", "Некорректный идентификатор задачи", parsed.error.issues);
  }

  await requireTaskOwner(parsed.data.id);
  const result = await getScore(parsed.data.id);
  if (!result) return apiError(404, "task_not_found", "Задача не найдена");

  return Response.json(taskScoreResponseSchema.parse(result));
  } catch(error) { return toResponse(error); }
}

import { requireTaskOwner } from "@/features/task-card/api/access";
import { idSchema } from "@/entities/workspace/contracts";
import { ApiError } from "@/shared/api/errors";
import { EXTRACT_SIZE_LIMIT, extractDocumentText } from "@/server/workspace/documents";
import { apiRoute } from "@/server/workspace/http";
import { getTask, requireRole } from "@/server/workspace/service";

export const runtime = "nodejs";

export const POST = apiRoute(async (request, context, session) => {
  requireRole(session, "business");
  const id = idSchema.parse((await context.params).id);
  await getTask(id, session);
  await requireTaskOwner(id);

  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > EXTRACT_SIZE_LIMIT + 64 * 1024) {
    throw new ApiError(413, "DOCUMENT_TOO_LARGE", "Файл больше 10 МБ.");
  }
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("multipart/form-data")) {
    throw new ApiError(415, "MULTIPART_REQUIRED", "Отправьте файл как multipart/form-data.");
  }
  const file = (await request.formData()).get("file");
  if (!(file instanceof File)) {
    throw new ApiError(400, "FILE_REQUIRED", "Прикрепите файл.");
  }
  return extractDocumentText(file, request.signal);
});

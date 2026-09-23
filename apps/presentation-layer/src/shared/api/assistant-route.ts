import {
  assistantReplySchema,
  assistantRequestSchema,
} from "./contracts/assistant";
import { askTaskManagerAgent } from "./mastra";

function errorResponse(
  status: number,
  code: string,
  message: string,
  details?: unknown,
): Response {
  return Response.json(
    { error: { code, message, ...(details ? { details } : {}) } },
    { status },
  );
}

/**
 * BFF-ход чата менеджера: валидация (ADR-009) → агент Mastra.
 * Сбой AI не становится ошибкой HTTP — `200` с `fallbackUsed: true`,
 * UI в этом случае показывает локальный детерминированный ответ.
 */
export async function POST(request: Request): Promise<Response> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return errorResponse(400, "bad_json", "Некорректный JSON в запросе");
  }

  const parsed = assistantRequestSchema.safeParse(raw);
  if (!parsed.success)
    return errorResponse(
      422,
      "invalid_request",
      "Некорректные данные запроса чата",
      parsed.error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      })),
    );

  const reply = await askTaskManagerAgent(parsed.data);
  if (reply === null)
    return Response.json(
      assistantReplySchema.parse({ reply: "", fallbackUsed: true }),
    );
  return Response.json(
    assistantReplySchema.parse({ reply, fallbackUsed: false }),
  );
}

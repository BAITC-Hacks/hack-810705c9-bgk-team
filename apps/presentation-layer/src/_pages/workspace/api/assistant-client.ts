import {
  assistantReplySchema,
  evaluateResponseSchema,
  grillResponseSchema,
  type AssistantReply,
  type AssistantRequest,
  type EvaluateResponse,
  type GrillRequest,
  type GrillResponse,
} from "@/shared/api/contracts/assistant";

const ASSISTANT_TIMEOUT_MS = 20_000;
/** Старт/resume прожарки — несколько LLM-вызовов воркфлоу, ждём дольше. */
const GRILL_TIMEOUT_MS = 120_000;
const EVALUATE_TIMEOUT_MS = 60_000;

async function postJson<T>(
  path: string,
  body: unknown,
  schema: { safeParse(value: unknown): { success: boolean; data?: T } },
  timeoutMs: number,
): Promise<T | null> {
  try {
    const response = await fetch(path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!response.ok) return null;
    const parsed = schema.safeParse(await response.json());
    return parsed.success && parsed.data !== undefined ? parsed.data : null;
  } catch {
    return null;
  }
}

/**
 * Вызов BFF-чата менеджера из браузера. Сетевой сбой, таймаут или
 * `fallbackUsed` от BFF → `null`: вызывающий показывает сообщение
 * об ошибке, локальных ответов ассистента больше нет.
 */
export async function askTaskManager(
  request: AssistantRequest,
): Promise<AssistantReply | null> {
  const reply = await postJson(
    "/api/assistant",
    request,
    assistantReplySchema,
    ASSISTANT_TIMEOUT_MS,
  );
  if (!reply || reply.fallbackUsed || !reply.reply.trim()) return null;
  return reply;
}

/** Оценка задачи agentом task-evaluator-agent → RatingReport либо null. */
export async function evaluateTask(input: {
  threadId: string;
  taskSummary: string;
}): Promise<EvaluateResponse | null> {
  return postJson(
    "/api/evaluate",
    input,
    evaluateResponseSchema,
    EVALUATE_TIMEOUT_MS,
  );
}

/** Старт либо resume воркфлоу прожарки; null — Mastra недоступна. */
export async function runGrill(
  request: GrillRequest,
): Promise<GrillResponse | null> {
  return postJson("/api/grill", request, grillResponseSchema, GRILL_TIMEOUT_MS);
}

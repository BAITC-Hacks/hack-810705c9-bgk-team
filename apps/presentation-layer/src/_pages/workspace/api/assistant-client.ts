import {
  assistantReplySchema,
  type AssistantRequest,
  type AssistantReply,
} from "@/shared/api/contracts/assistant";

const ASSISTANT_TIMEOUT_MS = 20_000;

/**
 * Вызов BFF-чата менеджера из браузера. Сетевой сбой, таймаут или
 * `fallbackUsed` от BFF → `null`: вызывающий показывает локальный
 * детерминированный ответ, интерактивность не ломает демо.
 */
export async function askTaskManager(
  request: AssistantRequest,
): Promise<AssistantReply | null> {
  try {
    const response = await fetch("/api/assistant", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(request),
      signal: AbortSignal.timeout(ASSISTANT_TIMEOUT_MS),
    });
    if (!response.ok) return null;
    const payload = await response.json();
    const parsed = assistantReplySchema.safeParse(payload);
    if (!parsed.success) return null;
    if (parsed.data.fallbackUsed || !parsed.data.reply.trim()) return null;
    return parsed.data;
  } catch {
    return null;
  }
}

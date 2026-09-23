import { MastraClient } from "@mastra/client-js";

import {
  type AssistantContext,
  type AssistantRequest,
} from "./contracts/assistant";

const ASSISTANT_AGENT_ID = "task-manager-agent";
const ASSISTANT_TIMEOUT_MS = 15_000;
/** Mastra требует resource для memory-thread; демо без auth — единый ресурс роли. */
const ASSISTANT_RESOURCE_ID = "workspace-business";

let client: MastraClient | undefined;

/** server-only: экспонируется для BFF-хендлеров evaluate/grill. */
export function getMastraClient(): MastraClient {
  client ??= new MastraClient({
    baseUrl: process.env.MASTRA_API_URL || "http://localhost:4111",
  });
  return client;
}

function formatProposals(context: AssistantContext): string[] {
  if (!context.proposals.length)
    return ["Отклики команд: пока нет.", ""];
  return [
    "Отклики команд:",
    ...context.proposals.flatMap((proposal, index) => [
      `${index + 1}. ${proposal.teamName} · ${proposal.statusLabel}`,
      `Идея: ${proposal.idea || "не указана"}`,
      `План: ${proposal.plan || "не указан"}`,
      `Срок: ${proposal.timeline || "не указан"}`,
      ...(proposal.skills.length
        ? [`Навыки: ${proposal.skills.join(", ")}`]
        : []),
      "",
    ]),
  ];
}

/** Свежий снимок карточки + сообщение менеджера → один промпт хода. */
export function buildAssistantPrompt(request: AssistantRequest): string {
  const { context, skill, message } = request;
  const trimmed = message.trim();
  return [
    "Данные карточки задачи (свежий снимок из UI, авторитетны):",
    context.taskSummary,
    "",
    `Готовность: ${context.score} / 100 · ${context.readinessLabel}`,
    "Расшифровка баллов:",
    ...context.breakdown.map(
      (group) => `- ${group.label}: ${group.earned} / ${group.max}`,
    ),
    "",
    ...formatProposals(context),
    ...(skill ? ["", `Навык из меню: ${skill}.`] : []),
    "",
    trimmed
      ? `Сообщение менеджера: ${trimmed}`
      : "Сообщение менеджера: (пусто — ответь на навык)",
  ].join("\n");
}

/**
 * Ход интерактивного чата. Возвращает ответ агента или `null` при любом
 * сбое (Mastra недоступна, таймаут, пустой ответ) — вызывающий
 * подставляет локальный детерминированный ответ, ошибка не поднимается.
 */
export async function askTaskManagerAgent(
  request: AssistantRequest,
): Promise<string | null> {
  try {
    const result = await getMastraClient()
      .getAgent(ASSISTANT_AGENT_ID)
      .generate(buildAssistantPrompt(request), {
        memory: { thread: request.threadId, resource: ASSISTANT_RESOURCE_ID },
        abortSignal: AbortSignal.timeout(ASSISTANT_TIMEOUT_MS),
      });
    const text = result.text?.trim();
    return text ? text : null;
  } catch (error) {
    console.error("[assistant] Mastra call failed:", error);
    return null;
  }
}

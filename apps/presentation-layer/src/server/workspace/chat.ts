import { MastraClient } from "@mastra/client-js";
import type { ChatMessage } from "@/entities/workspace/chat-contracts";
import { ApiError } from "@/shared/api/errors";

/** Transport only: agent instructions and model configuration belong to Mastra. */
export async function generateChatReply(
  messages: ChatMessage[],
  signal?: AbortSignal,
): Promise<{ text: string }> {
  const agentId = process.env.MASTRA_CHAT_AGENT_ID?.trim();
  if (!agentId) {
    throw new ApiError(503, "CHAT_NOT_CONFIGURED", "Подключение помощника ещё не настроено.");
  }

  const timeout = AbortSignal.timeout(30_000);
  const abortSignal = signal ? AbortSignal.any([signal, timeout]) : timeout;
  try {
    const client = new MastraClient({
      baseUrl: process.env.MASTRA_API_URL?.trim() || "http://localhost:4111",
      // Generation may have side effects; do not silently repeat a failed turn.
      retries: 0,
    });
    const agentMessages = messages.map(({ role, content }) => role === "user"
      ? { role: "user" as const, content }
      : { role: "assistant" as const, content });
    const result = await client.getAgent(agentId).generate(agentMessages, { abortSignal });
    if (typeof result.text !== "string" || !result.text.trim()) {
      throw new Error("Empty Mastra response");
    }
    return { text: result.text };
  } catch {
    // Provider errors can contain credentials or submitted content.
    throw new ApiError(502, "CHAT_UNAVAILABLE", "Помощник временно недоступен. Попробуйте отправить сообщение ещё раз.");
  }
}

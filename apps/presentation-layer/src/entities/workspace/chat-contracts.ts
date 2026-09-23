import { z } from "zod";

const chatMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1).refine((text) => text.trim().length > 0),
}).strict().refine((message) => message.role === "assistant" || message.content.length <= 10000);

export const chatRequestSchema = z.object({
  messages: z.array(chatMessageSchema).min(1).refine(
    (messages) => messages.at(-1)?.role === "user",
    "Последнее сообщение должно быть от пользователя.",
  ),
}).strict();

export type ChatMessage = z.infer<typeof chatMessageSchema>;

/** Keep recent complete messages below the BFF's 128 KiB JSON body limit. */
export function prepareChatMessages(messages: ChatMessage[]): ChatMessage[] {
  const encoder = new TextEncoder();
  const recent: ChatMessage[] = [];
  let bytes = encoder.encode('{"messages":[]}').byteLength;
  for (let index = messages.length - 1; index >= 0; index--) {
    const { role, content } = messages[index];
    if (!content.trim()) continue;
    const message = { role, content };
    bytes += encoder.encode(JSON.stringify(message)).byteLength + 1;
    if (bytes > 96 * 1024) break;
    recent.push(message);
  }
  return recent.reverse();
}

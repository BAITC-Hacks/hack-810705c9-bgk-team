import { z } from "zod";

/** Per-message limits keep a turn with files below the BFF's 128 KiB JSON body limit. */
export const CHAT_ATTACHMENT_LIMIT = 3;
export const CHAT_ATTACHMENT_TEXT_LIMIT = 10_000;

const chatAttachmentSchema = z.object({
  name: z.string().trim().min(1).max(255),
  text: z.string().max(CHAT_ATTACHMENT_TEXT_LIMIT),
  truncated: z.boolean().optional(),
}).strict();

const chatMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string(),
  attachments: z.array(chatAttachmentSchema).max(CHAT_ATTACHMENT_LIMIT).optional(),
}).strict()
  .refine((message) => message.content.trim().length > 0 || !!message.attachments?.length)
  .refine((message) => message.role === "assistant" || message.content.length <= 10000)
  .refine((message) => message.role === "user" || !message.attachments?.length);

export const chatRequestSchema = z.object({
  messages: z.array(chatMessageSchema).min(1).refine(
    (messages) => messages.at(-1)?.role === "user",
    "Последнее сообщение должно быть от пользователя.",
  ),
}).strict();

export type ChatAttachment = z.infer<typeof chatAttachmentSchema>;
export type ChatMessage = z.infer<typeof chatMessageSchema>;

/** Keep recent complete messages below the BFF's 128 KiB JSON body limit. */
export function prepareChatMessages(messages: ChatMessage[]): ChatMessage[] {
  const encoder = new TextEncoder();
  const recent: ChatMessage[] = [];
  let bytes = encoder.encode('{"messages":[]}').byteLength;
  for (let index = messages.length - 1; index >= 0; index--) {
    const { role, content, attachments } = messages[index];
    if (!content.trim() && !attachments?.length) continue;
    const message: ChatMessage = attachments?.length ? { role, content, attachments } : { role, content };
    bytes += encoder.encode(JSON.stringify(message)).byteLength + 1;
    if (bytes > 96 * 1024) break;
    recent.push(message);
  }
  return recent.reverse();
}

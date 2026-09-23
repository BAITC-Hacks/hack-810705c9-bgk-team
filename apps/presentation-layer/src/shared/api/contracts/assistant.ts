import { z } from "zod";

/**
 * Контракт интерактивного чата менеджера «Чат по задаче» (ADR-009):
 * UI → BFF `POST /api/assistant` → Mastra `task-manager-agent`.
 * Demo-данные карточки живут во вкладке, поэтому контекст карточки
 * передаётся запросом, а не читается из БД.
 */
export const ASSISTANT_SKILLS = [
  "clarify",
  "readiness",
  "success",
  "compare",
] as const;

export const assistantSkillSchema = z.enum(ASSISTANT_SKILLS);
export type AssistantSkill = z.infer<typeof assistantSkillSchema>;

export const assistantContextSchema = z.object({
  taskSummary: z.string().min(1).max(20000),
  score: z.number().int().min(0).max(100),
  readinessLabel: z.string().max(80),
  breakdown: z.array(
    z.object({
      label: z.string().max(120),
      earned: z.number().int().min(0),
      max: z.number().int().min(1),
    }),
  ).max(20),
  proposals: z.array(
    z.object({
      teamName: z.string().max(120),
      statusLabel: z.string().max(80),
      idea: z.string().max(4000),
      plan: z.string().max(4000),
      timeline: z.string().max(400),
      skills: z.array(z.string().max(80)).max(20),
    }),
  ).max(30),
});
export type AssistantContext = z.infer<typeof assistantContextSchema>;

export const assistantRequestSchema = z
  .object({
    /** Один memory-thread на задачу: `${sessionId}:${taskId}`. */
    threadId: z.string().min(1).max(200),
    skill: assistantSkillSchema.optional(),
    message: z.string().max(4000),
    context: assistantContextSchema,
  })
  .refine((request) => !!request.skill || request.message.trim().length > 0, {
    message: "Нужен навык или текст сообщения",
  });
export type AssistantRequest = z.infer<typeof assistantRequestSchema>;

/** Сбой AI — не ошибка HTTP: `fallbackUsed: true`, UI берёт локальный ответ. */
export const assistantReplySchema = z.object({
  reply: z.string(),
  fallbackUsed: z.boolean(),
});
export type AssistantReply = z.infer<typeof assistantReplySchema>;

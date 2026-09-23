import { z } from "zod";

// Литералы повторяют @/entities/task (shared не импортирует entities по FSD).
// Расхождение ловит tsc: getScore возвращает TaskScoreResponse.
export const scoreNodeSchema = z.enum([
  "context.current",
  "context.size",
  "context.change",
  "data.what",
  "data.volume",
  "data.sample",
  "result.artifact",
  "result.acceptance",
  "criteria.items",
  "constraints.deadline",
  "constraints.stack",
  "constraints.other",
  "users.role",
  "users.scale",
  "link.contact",
  "link.cadence",
  "link.response",
]);

export const levelSchema = z.enum(["draft", "working", "ready", "priority"]);

export const taskScoreParamsSchema = z.object({
  id: z.uuid(),
});

export const taskScoreResponseSchema = z.object({
  taskId: z.uuid(),
  total: z.number().int().min(0).max(100),
  level: levelSchema,
  levelLabel: z.string(),
  lines: z.array(
    z.object({
      node: scoreNodeSchema,
      points: z.number(),
      max: z.number(),
      reason: z.string(),
    }),
  ),
  missing: z.array(z.object({ node: scoreNodeSchema, weight: z.number() })),
  nextStep: z
    .object({ node: scoreNodeSchema, gain: z.number(), levelAfter: levelSchema })
    .nullable(),
  place: z.number().int().min(1),
  lastChange: z
    .object({
      before: z.number().int(),
      after: z.number().int(),
      levelBefore: levelSchema,
      levelAfter: levelSchema,
      placeBefore: z.number().int(),
      placeAfter: z.number().int(),
      node: z.union([scoreNodeSchema, z.literal("task")]),
      at: z.iso.datetime({ offset: true }),
    })
    .nullable(),
});

export type TaskScoreParams = z.infer<typeof taskScoreParamsSchema>;
export type TaskScoreResponse = z.infer<typeof taskScoreResponseSchema>;

import { resourceIdSchema } from "@/shared/api/contracts/resource-id";
import { z } from "zod";

import { nodeIdSchema as scoreNodeSchema, readinessLevelSchema as levelSchema } from './common';
export { nodeIdSchema as scoreNodeSchema, readinessLevelSchema as levelSchema } from './common';

export const taskScoreParamsSchema = z.object({
  id: resourceIdSchema,
});

export const taskScoreResponseSchema = z.object({
  taskId: resourceIdSchema,
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

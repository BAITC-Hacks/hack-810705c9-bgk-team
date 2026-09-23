import { z } from 'zod';

import { publicTaskSchema } from './common';

export const recommendationsParamsSchema = z.object({ id: z.string().min(1) });

const fitExplanationSchema = z.object({
  value: z.number().min(0).max(1),
  matchedRoles: z.array(z.string()),
  missingRoles: z.array(z.string()),
  matchedSkills: z.array(z.string()),
  missingSkills: z.array(z.string()),
  topicMatch: z.boolean(),
});

export const recommendationItemSchema = z.object({
  task: publicTaskSchema,
  fit: fitExplanationSchema,
  rankScore: z.number(),
});

/** ADR-006 §2: { items, catalogRemainder } — один набор для колоды и сетки. */
export const recommendationsResponseSchema = z.object({
  items: z.array(recommendationItemSchema),
  catalogRemainder: z.number().int().min(0),
});
export type RecommendationsResponse = z.infer<typeof recommendationsResponseSchema>;

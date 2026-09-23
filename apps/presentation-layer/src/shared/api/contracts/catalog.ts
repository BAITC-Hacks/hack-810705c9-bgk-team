import { z } from 'zod';

import { readinessLevelSchema, taskSchema, workFormatSchema } from './common';

/** GET /api/catalog?topic=&level=&role=&format= (FR-4.5). */
export const catalogQuerySchema = z.object({
  topic: z.string().optional(),
  level: readinessLevelSchema.optional(),
  role: z.string().optional(),
  format: workFormatSchema.optional(),
});
export type CatalogQuery = z.infer<typeof catalogQuerySchema>;

export const catalogItemSchema = z.object({
  task: taskSchema,
  label: z.enum(['needs_clarification', 'fully_ready']).optional(),
  unknown: z.array(z.object({ node: z.string(), weight: z.number() })),
});

export const catalogResponseSchema = z.object({ items: z.array(catalogItemSchema) });
export type CatalogResponse = z.infer<typeof catalogResponseSchema>;

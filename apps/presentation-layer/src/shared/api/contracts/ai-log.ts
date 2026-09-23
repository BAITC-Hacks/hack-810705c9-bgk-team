import { z } from 'zod';
import { dateTimeSchema } from './common';
import { resourceIdSchema } from './resource-id';
export const aiLogQuerySchema=z.object({taskId:resourceIdSchema});
export type AiLogQuery=z.infer<typeof aiLogQuerySchema>;
export const aiLogEntrySchema=z.object({
 id:z.string(),taskId:resourceIdSchema,turnId:z.number().int().nullable(),kind:z.string(),agent:z.string(),
 model:z.string().nullable(),prompt:z.string().nullable(),input:z.unknown(),rawOutput:z.string().nullable(),
 parseOk:z.boolean(),retryCount:z.number().int(),dropped:z.array(z.unknown()),latencyMs:z.number().nullable(),error:z.string().nullable(),
 fallbackUsed:z.boolean(),fallbackReason:z.string().nullable(),createdAt:dateTimeSchema,
});
export type ApiAiLogEntry=z.infer<typeof aiLogEntrySchema>;
export const aiLogResponseSchema=z.object({entries:z.array(aiLogEntrySchema)});
export type AiLogResponse=z.infer<typeof aiLogResponseSchema>;

import { z } from 'zod';
import { criterionSchema, dateTimeSchema, fieldSchema, publicTaskSchema, taskSchema, workFormatSchema } from './common';
import { grillStateSchema } from './grill';
import { proposalSchema } from './proposals';
import { taskScoreResponseSchema } from './score';

export const createTaskRequestSchema=z.object({description:z.string().trim().min(20,'Черновик должен быть не короче 20 символов.').max(2000,'Черновик должен быть не длиннее 2000 символов.')});
export type CreateTaskRequest=z.infer<typeof createTaskRequestSchema>;
const workspacePatchSchema=z.object({
  title:z.string().optional(),company:z.string().optional(),industry:z.string().optional(),
  fields:z.record(z.string(),z.string()).optional(),confirmedFields:z.array(z.string()).optional(),status:z.enum(['draft','published']).optional(),
});
export const updateTaskRequestSchema=z.object({
  task:workspacePatchSchema.optional(),title:z.string().optional(),company:z.string().optional(),topic:z.string().optional(),
  engagement:workFormatSchema.optional(),neededRoles:z.array(z.string()).optional(),neededSkills:z.array(z.string()).optional(),
  tagsState:z.enum(['suggested','confirmed']).optional(),compensationNote:z.string().optional(),
  fields:z.record(z.string(),z.string()).optional(),confirmedFields:z.array(z.string()).optional(),status:z.enum(['draft','published']).optional(),
});
export type UpdateTaskRequest=z.infer<typeof updateTaskRequestSchema>;
export const workspaceTaskProjectionSchema=z.object({
  id:z.string(),title:z.string(),company:z.string(),industry:z.string(),description:z.string(),
  fields:z.record(z.string(),z.string()),confirmedFields:z.array(z.string()),status:z.enum(['draft','published']),
  score:z.number(),version:z.number().int(),createdAt:dateTimeSchema,publishedAt:dateTimeSchema.nullable(),
}).passthrough();
const workspaceQuestionSchema=z.object({field:z.string(),node:z.string(),question:z.string()});
export const taskMutationResponseSchema=grillStateSchema.extend({task:workspaceTaskProjectionSchema,question:workspaceQuestionSchema.nullable(),fallbackUsed:z.boolean().optional(),sessionVersion:z.number().int().optional()});
export const createTaskResponseSchema=taskMutationResponseSchema;
export type CreateTaskResponse=z.infer<typeof createTaskResponseSchema>;
export const updateTaskResponseSchema=taskMutationResponseSchema;
export type UpdateTaskResponse=z.infer<typeof updateTaskResponseSchema>;
export const publishTaskResponseSchema=taskMutationResponseSchema;
export type PublishTaskResponse=z.infer<typeof publishTaskResponseSchema>;
export const closeTaskResponseSchema=z.object({task:taskSchema,rejectedCount:z.number().int().nonnegative()});
export type CloseTaskResponse=z.infer<typeof closeTaskResponseSchema>;
export const getScoreResponseSchema=taskScoreResponseSchema;
export const scoreBreakdownItemSchema=taskScoreResponseSchema.shape.lines.element;
export type GetScoreResponse=z.infer<typeof getScoreResponseSchema>;
export const readTaskResponseSchema=z.object({
  task:z.union([taskSchema.extend({fields:z.array(fieldSchema)}),publicTaskSchema]),criteria:z.array(criterionSchema.omit({thresholdHasNumber:true}).extend({thresholdHasNumber:z.boolean().optional()})),
  grill:grillStateSchema.nullable(),score:taskScoreResponseSchema.nullable(),proposals:z.array(proposalSchema),
});
export type ReadTaskResponse=z.infer<typeof readTaskResponseSchema>;

export const listTasksResponseSchema=z.object({
 tasks:z.array(workspaceTaskProjectionSchema),questions:z.record(z.string(),workspaceQuestionSchema),
 proposals:z.array(z.object({id:z.string(),taskId:z.string(),teamId:z.string(),idea:z.string(),plan:z.string(),timeline:z.string(),prototypeUrl:z.string(),status:z.enum(['pending','selected','rejected']),milestoneConfirmed:z.boolean()})),
});

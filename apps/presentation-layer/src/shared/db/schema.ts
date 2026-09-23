import { boolean, integer, jsonb, pgTable, serial, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const tasks = pgTable('tasks', {
  id: uuid('id').defaultRandom().primaryKey(),
  title: text('title'),
  description: text('description').notNull(),
  company: text('company').notNull().default('Моя компания'),
  topic: text('topic').notNull().default('Другое'),
  status: text('status').notNull().default('draft'),
  engagement: text('engagement').notNull().default('practice'),
  neededRoles: text('needed_roles').array().notNull().default([]),
  neededSkills: text('needed_skills').array().notNull().default([]),
  score: integer('score').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const taskFields = pgTable('task_fields', {
  id: uuid('id').defaultRandom().primaryKey(),
  taskId: uuid('task_id').notNull().references(() => tasks.id, { onDelete: 'cascade' }),
  key: text('key').notNull(),
  value: text('value').notNull().default(''),
  state: text('state').notNull().default('empty'),
  notApplicable: boolean('not_applicable').notNull().default(false),
  source: text('source'),
  sourceQuote: text('source_quote'),
  sourceTurnId: uuid('source_turn_id'),
  revision: integer('revision').notNull().default(0),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [uniqueIndex('task_fields_task_key_unique').on(table.taskId, table.key)]);

export const grillSessions = pgTable('grill_sessions', {
  id: uuid('id').defaultRandom().primaryKey(),
  taskId: uuid('task_id').notNull().references(() => tasks.id, { onDelete: 'cascade' }),
  currentNode: text('current_node'),
  status: text('status').notNull().default('active'),
  questionCount: integer('question_count').notNull().default(0),
  version: integer('version').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const grillTurns = pgTable('grill_turns', {
  id: uuid('id').defaultRandom().primaryKey(),
  sessionId: uuid('session_id').notNull().references(() => grillSessions.id, { onDelete: 'cascade' }),
  nodeKey: text('node_key').notNull(),
  question: text('question').notNull(),
  options: jsonb('options').$type<string[]>().notNull().default([]),
  answer: text('answer'),
  fallbackUsed: boolean('fallback_used').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const scoreEvents = pgTable('score_events', {
  id: uuid('id').defaultRandom().primaryKey(),
  taskId: uuid('task_id').notNull().references(() => tasks.id, { onDelete: 'cascade' }),
  nodeKey: text('node_key'),
  before: integer('before').notNull(),
  after: integer('after').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const aiLogs = pgTable('ai_logs', {
  id: uuid('id').defaultRandom().primaryKey(),
  taskId: uuid('task_id').notNull().references(() => tasks.id, { onDelete: 'cascade' }),
  turnId: uuid('turn_id').references(() => grillTurns.id, { onDelete: 'set null' }),
  kind: text('kind').notNull(),
  agent: text('agent').notNull(),
  model: text('model'),
  prompt: text('prompt'),
  input: jsonb('input').$type<unknown>().notNull(),
  rawOutput: text('raw_output'),
  parseOk: boolean('parse_ok').notNull().default(false),
  retryCount: integer('retry_count').notNull().default(0),
  dropped: jsonb('dropped').$type<unknown[]>().notNull().default([]),
  latencyMs: integer('latency_ms'),
  error: text('error'),
  fallbackUsed: boolean('fallback_used').notNull().default(false),
  fallbackReason: text('fallback_reason'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const proposals = pgTable('proposals', {
  id: uuid('id').defaultRandom().primaryKey(),
  taskId: uuid('task_id').notNull().references(() => tasks.id, { onDelete: 'cascade' }),
  teamId: text('team_id').notNull(),
  idea: text('idea').notNull(),
  plan: text('plan').notNull().default(''),
  timeline: text('timeline').notNull().default(''),
  prototypeUrl: text('prototype_url'),
  fit: integer('fit').notNull().default(0),
  status: text('status').notNull().default('submitted'),
  rejectReason: text('reject_reason'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  decidedAt: timestamp('decided_at', { withTimezone: true }),
});

export const proposalStages = pgTable('proposal_stages', {
  id: uuid('id').defaultRandom().primaryKey(),
  proposalId: uuid('proposal_id').notNull().references(() => proposals.id, { onDelete: 'cascade' }),
  criterion: text('criterion').notNull(),
  evidenceUrl: text('evidence_url'),
  status: text('status').notNull().default('open'),
  businessComment: text('business_comment'),
  points: integer('points').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

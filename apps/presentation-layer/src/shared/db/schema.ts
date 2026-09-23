import { sql } from 'drizzle-orm';
import { boolean, check, index, integer, jsonb, pgEnum, pgTable, primaryKey, real, uniqueIndex, serial, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core';

const id = () => text('id').primaryKey().$defaultFn(() => crypto.randomUUID());

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const businesses = pgTable('business', {
  id: id(),
  name: text('name').notNull(),
  industry: text('industry').notNull().default(''),
  logoKey: text('logo_key'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const TASK_STATUSES = ['draft', 'published', 'in_work', 'closed'] as const;

export const tasks = pgTable('task', {
  id: id(),
  version: integer('version').notNull().default(1),
  legacyWorkspace: jsonb('legacy_workspace').$type<Record<string, unknown>>(),
  title: text('title').notNull().default(''),
  description: text('description').notNull(),
  businessId: text('business_id').notNull().references(() => businesses.id),
  criteriaVersion: integer('criteria_version').notNull().default(1),
  compensationNote: text('compensation_note'),
  company: text('company').notNull().default('Моя компания'),
  topic: text('topic').notNull().default('Другое'),
  status: text('status', { enum: TASK_STATUSES }).notNull().default('draft'),
  engagement: text('engagement', { enum: ['paid', 'practice', 'both'] }).notNull().default('practice'),
  neededRoles: text('needed_roles').array().notNull().default([]),
  neededSkills: text('needed_skills').array().notNull().default([]),
  score: integer('score').notNull().default(0),
  publishedAt: timestamp('published_at', { withTimezone: true }),
  workFormat: text('work_format'),
  paymentTerms: text('payment_terms'),
  tagsState: text('tags_state').notNull().default('suggested'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const grillSessionStatus = pgEnum('grill_session_status', ['active', 'finished']);
export const grillFieldState = pgEnum('grill_field_state', ['suggested', 'confirmed']);
export const grillFieldSource = pgEnum('grill_field_source', ['draft', 'turn', 'manual']);
export const grillTagsState = pgEnum('grill_tags_state', ['suggested', 'confirmed']);
export const grillDraftCheckpointState = pgEnum('grill_draft_checkpoint_state', [
  'pending',
  'confirmed',
]);

export const grillSession = pgTable('grill_session', {
  id: serial('id').primaryKey(),
  taskId: text('task_id').notNull().unique().references(() => tasks.id, { onDelete: 'cascade' }),
  status: grillSessionStatus('status').notNull().default('active'),
  currentNode: text('current_node'),
  currentBlock: text('current_block'),
  pushbacks: jsonb('pushbacks').$type<Record<string, 0 | 1>>().notNull().default({}),
  skippedNodes: jsonb('skipped_nodes').$type<string[]>().notNull().default([]),
  questionsAsked: integer('questions_asked').notNull().default(0),
  version: integer('version').notNull().default(0),
  tagsState: grillTagsState('tags_state').notNull().default('suggested'),
  draftCheckpointState: grillDraftCheckpointState('draft_checkpoint_state')
    .notNull()
    .default('pending'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  check('grill_session_questions_asked_nonnegative', sql`${table.questionsAsked} >= 0`),
  check('grill_session_version_nonnegative', sql`${table.version} >= 0`),
]);

export const grillTurn = pgTable('grill_turn', {
  id: serial('id').primaryKey(),
  sessionId: integer('session_id')
    .notNull()
    .references(() => grillSession.id, { onDelete: 'cascade' }),
  seq: integer('seq').notNull(),
  node: text('node').notNull(),
  question: text('question').notNull(),
  options: text('options').array().notNull().default([]),
  isPushback: boolean('is_pushback').notNull().default(false),
  answer: text('answer'),
  coveredNodes: text('covered_nodes').array().notNull().default([]),
  specificity: text('specificity'),
  fallbackUsed: boolean('fallback_used').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  unique('grill_turn_session_seq_unique').on(table.sessionId, table.seq),
  check('grill_turn_seq_positive', sql`${table.seq} > 0`),
]);

export const taskField = pgTable('task_field', {
  taskId: text('task_id').notNull().references(() => tasks.id, { onDelete: 'cascade' }),
  node: text('node').notNull(),
  value: text('value').notNull().default(''),
  state: grillFieldState('state').notNull().default('suggested'),
  notApplicable: boolean('not_applicable').notNull().default(false),
  naNote: text('na_note'),
  source: grillFieldSource('source').notNull(),
  sourceQuote: text('source_quote').notNull(),
  sourceTurnId: integer('source_turn_id').references(() => grillTurn.id, { onDelete: 'set null' }),
  confirmedAt: timestamp('confirmed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  // Missing rows mean empty; any stored field must have a traceable source.
  primaryKey({ name: 'task_field_pk', columns: [table.taskId, table.node] }),
  check('task_field_na_note_required', sql`NOT ${table.notApplicable} OR ${table.naNote} IS NOT NULL`),
]);

export const criterion = pgTable('criterion', {
  id: uuid('id').defaultRandom().notNull().unique(),
  taskId: text('task_id').notNull().references(() => tasks.id, { onDelete: 'cascade' }),
  position: integer('position').notNull(),
  version: integer('version').notNull().default(1),
  metric: text('metric').notNull(),
  threshold: text('threshold').notNull(),
  thresholdHasNumber: boolean('threshold_has_number').notNull().default(false),
  howToCheck: text('how_to_check').notNull(),
  state: grillFieldState('state').notNull().default('suggested'),
  sourceQuote: text('source_quote').notNull(),
  sourceTurnId: integer('source_turn_id').references(() => grillTurn.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  primaryKey({ name: 'criterion_pk', columns: [table.taskId, table.position] }),
  check('criterion_position_range', sql`${table.position} BETWEEN 1 AND 3`),
]);
export const scoreEvent = pgTable(
  'score_event',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    taskId: text('task_id')
      .notNull()
      .references(() => task.id, { onDelete: 'cascade' }),
    before: integer('before').notNull(),
    after: integer('after').notNull(),
    levelBefore: text('level_before').notNull(),
    levelAfter: text('level_after').notNull(),
    // Узел-причина пересчёта или 'task'
    node: text('node').notNull(),
    placeBefore: integer('place_before').notNull(),
    placeAfter: integer('place_after').notNull(),
    at: timestamp('at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index('score_event_task_at_idx').on(t.taskId, t.at.desc())],
);

export const aiLogs = pgTable('ai_logs', {
  id: uuid('id').defaultRandom().primaryKey(),
  taskId: text('task_id').notNull().references(() => tasks.id, { onDelete: 'cascade' }),
  turnId: integer('turn_id').references(() => grillTurn.id, { onDelete: 'set null' }),
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

export const taskFields = taskField;
export const grillSessions = grillSession;
export const grillTurns = grillTurn;

export const task = tasks;
export type TaskRow = typeof task.$inferSelect;
export type TaskFieldRow = typeof taskField.$inferSelect;
export type CriterionRow = typeof criterion.$inferSelect;
export type ScoreEventRow = typeof scoreEvent.$inferSelect;

export const engagement = pgEnum('engagement', ['paid', 'practice', 'both']);
export const swipeAction = pgEnum('swipe_action', ['skip', 'missing']);
export const teams = pgTable('team', {
  id: id(),
  initials: text('initials').notNull().default(''),
  tagline: text('tagline').notNull().default(''),
  members: integer('members').notNull().default(3),
  color: text('color').notNull().default(''),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  name: text('name').notNull(),
  roles: text('roles').array().notNull().default([]),
  skills: text('skills').array().notNull().default([]),
  technologies: text('technologies').array().notNull().default([]),
  interests: text('interests').array().notNull().default([]),
  lookingFor: engagement('looking_for').notNull().default('both'),
});

export const swipes = pgTable(
  'swipe',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    teamId: text('team_id')
      .notNull()
      .references(() => teams.id, { onDelete: 'cascade' }),
    taskId: text('task_id')
      .notNull()
      .references(() => tasks.id, { onDelete: 'cascade' }),
    action: swipeAction('action').notNull(),
    block: text('block'),
    note: text('note'),
    at: timestamp('at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [unique('swipe_team_task_action_uq').on(t.teamId, t.taskId, t.action)],
);

// --- ADR-007: отклики, мэтч (= proposal.accepted) и этапы. ---

export const PROPOSAL_STATUSES = ['submitted', 'on_hold', 'accepted', 'rejected'] as const;
export const REJECT_REASONS = ['roles', 'stack', 'deadline', 'plan', 'other', 'task_closed'] as const;

export type CriteriaAnswers = {
  criteriaVersion: number;
  answers: Record<string, string>; // criterion.id → «как проверим»
};

export type KickoffItem = { key: string; label: string; value: string };

export type Kickoff = {
  items: KickoffItem[];
  firstStage: { criterionId: string; metric: string; threshold: string } | null;
  contact: string | null;
  builtAt: string;
};

export const proposals = pgTable(
  'proposal',
  {
    id: id(),
    taskId: text('task_id')
      .notNull()
      .references(() => tasks.id),
    teamId: text('team_id')
      .notNull()
      .references(() => teams.id),
    solution: text('solution').notNull(),
    plan: text('plan').notNull(),
    teamRoles: text('team_roles').array().notNull(),
    deadline: text('deadline').notNull(),
    repoUrl: text('repo_url'),
    criteriaAnswers: jsonb('criteria_answers').$type<CriteriaAnswers>().notNull(),
    fit: real('fit').notNull(),
    status: text('status', { enum: PROPOSAL_STATUSES }).notNull().default('submitted'),
    rejectReason: text('reject_reason', { enum: REJECT_REASONS }),
    rejectNote: text('reject_note'),
    decidedAt: timestamp('decided_at', { withTimezone: true }),
    acceptedAt: timestamp('accepted_at', { withTimezone: true }),
    kickoff: jsonb('kickoff').$type<Kickoff>(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    // FR-6.4: один активный отклик команды на задачу.
    uniqueIndex('proposal_active_team_task_uq')
      .on(t.taskId, t.teamId)
      .where(sql`${t.status} in ('submitted', 'on_hold', 'accepted')`),
    index('proposal_task_idx').on(t.taskId),
    check('proposal_fit_range', sql`${t.fit} >= 0 and ${t.fit} <= 1`),
  ],
);

export const STAGE_STATUSES = ['open', 'claimed', 'confirmed', 'returned'] as const;

export const stages = pgTable(
  'stage',
  {
    id: id(),
    proposalId: text('proposal_id')
      .notNull()
      .references(() => proposals.id),
    criterionId: text('criterion_id').notNull(),
    // Снимок критерия на момент мэтча (FR-8.1); на живой criterion не ссылается.
    criteriaVersion: integer('criteria_version').notNull(),
    position: integer('position').notNull().default(0),
    metric: text('metric').notNull(),
    threshold: text('threshold').notNull(),
    howToCheck: text('how_to_check').notNull(),
    status: text('status', { enum: STAGE_STATUSES }).notNull().default('open'),
    reportUrl: text('report_url'),
    teamComment: text('team_comment'),
    businessComment: text('business_comment'),
    points: integer('points').notNull().default(0),
    claimedAt: timestamp('claimed_at', { withTimezone: true }),
    confirmedAt: timestamp('confirmed_at', { withTimezone: true }),
  },
  (t) => [
    uniqueIndex('stage_proposal_criterion_uq').on(t.proposalId, t.criterionId),
    index('stage_proposal_idx').on(t.proposalId),
    // +10 только у подтверждённого этапа (FR-8.4).
    check(
      'stage_points_confirmed',
      sql`(${t.status} = 'confirmed' and ${t.points} = 10) or (${t.status} <> 'confirmed' and ${t.points} = 0)`,
    ),
  ],
);

export const criteria = criterion;
export const fields = taskField;

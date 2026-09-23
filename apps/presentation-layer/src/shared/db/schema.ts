import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  real,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

const id = () =>
  text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID());

// --- Минимальные таблицы, от которых зависит ADR-007. ---
// ИНТЕГРАЦИЯ: business/task/field/criterion/team принадлежат ADR-004/005/006.
// Здесь только столбцы, нужные откликам и этапам; при слиянии оставить одну
// версию каждой таблицы и перегенерировать миграцию владельцем схемы.

export const businesses = pgTable('business', {
  id: id(),
  name: text('name').notNull(),
  industry: text('industry').notNull().default(''),
});

export const TASK_STATUSES = ['draft', 'published', 'in_work', 'closed'] as const;

export const tasks = pgTable('task', {
  id: id(),
  businessId: text('business_id')
    .notNull()
    .references(() => businesses.id),
  title: text('title').notNull(),
  topic: text('topic').notNull().default(''),
  status: text('status', { enum: TASK_STATUSES }).notNull().default('draft'),
  engagement: text('engagement', { enum: ['job', 'practice', 'both'] })
    .notNull()
    .default('job'),
  compensationNote: text('compensation_note'),
  neededRoles: text('needed_roles').array().notNull().default(sql`'{}'::text[]`),
  neededSkills: text('needed_skills').array().notNull().default(sql`'{}'::text[]`),
  criteriaVersion: integer('criteria_version').notNull().default(1),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const fields = pgTable(
  'field',
  {
    taskId: text('task_id')
      .notNull()
      .references(() => tasks.id),
    node: text('node').notNull(),
    value: text('value').notNull().default(''),
    state: text('state', { enum: ['empty', 'suggested', 'confirmed'] })
      .notNull()
      .default('empty'),
    notApplicable: boolean('not_applicable').notNull().default(false),
  },
  (t) => [uniqueIndex('field_task_node_uq').on(t.taskId, t.node)],
);

export const criteria = pgTable('criterion', {
  id: id(),
  taskId: text('task_id')
    .notNull()
    .references(() => tasks.id),
  position: integer('position').notNull().default(0),
  metric: text('metric').notNull(),
  threshold: text('threshold').notNull().default(''),
  howToCheck: text('how_to_check').notNull().default(''),
  version: integer('version').notNull().default(1),
  // Только подтверждённые бизнесом критерии становятся этапами.
  confirmed: boolean('confirmed').notNull().default(true),
});

export const teams = pgTable('team', {
  id: id(),
  name: text('name').notNull(),
  roles: text('roles').array().notNull().default(sql`'{}'::text[]`),
  skills: text('skills').array().notNull().default(sql`'{}'::text[]`),
  technologies: text('technologies').array().notNull().default(sql`'{}'::text[]`),
  interests: text('interests').array().notNull().default(sql`'{}'::text[]`),
});

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

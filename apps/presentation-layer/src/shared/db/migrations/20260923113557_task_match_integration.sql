CREATE TYPE "public"."engagement" AS ENUM('paid', 'practice', 'both');--> statement-breakpoint
CREATE TYPE "public"."grill_draft_checkpoint_state" AS ENUM('pending', 'confirmed');--> statement-breakpoint
CREATE TYPE "public"."grill_field_source" AS ENUM('draft', 'turn', 'manual');--> statement-breakpoint
CREATE TYPE "public"."grill_field_state" AS ENUM('suggested', 'confirmed');--> statement-breakpoint
CREATE TYPE "public"."grill_session_status" AS ENUM('active', 'finished');--> statement-breakpoint
CREATE TYPE "public"."grill_tags_state" AS ENUM('suggested', 'confirmed');--> statement-breakpoint
CREATE TYPE "public"."swipe_action" AS ENUM('skip', 'missing');--> statement-breakpoint
CREATE TABLE "ai_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task_id" text NOT NULL,
	"turn_id" integer,
	"kind" text NOT NULL,
	"agent" text NOT NULL,
	"model" text,
	"prompt" text,
	"input" jsonb NOT NULL,
	"raw_output" text,
	"parse_ok" boolean DEFAULT false NOT NULL,
	"retry_count" integer DEFAULT 0 NOT NULL,
	"dropped" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"latency_ms" integer,
	"error" text,
	"fallback_used" boolean DEFAULT false NOT NULL,
	"fallback_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "business" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"industry" text DEFAULT '' NOT NULL,
	"logo_key" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "criterion" (
	"id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"task_id" text NOT NULL,
	"position" integer NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"metric" text NOT NULL,
	"threshold" text NOT NULL,
	"threshold_has_number" boolean DEFAULT false NOT NULL,
	"how_to_check" text NOT NULL,
	"state" "grill_field_state" DEFAULT 'suggested' NOT NULL,
	"source_quote" text NOT NULL,
	"source_turn_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "criterion_pk" PRIMARY KEY("task_id","position"),
	CONSTRAINT "criterion_id_unique" UNIQUE("id"),
	CONSTRAINT "criterion_position_range" CHECK ("criterion"."position" BETWEEN 1 AND 3)
);
--> statement-breakpoint
CREATE TABLE "task_field" (
	"task_id" text NOT NULL,
	"node" text NOT NULL,
	"value" text DEFAULT '' NOT NULL,
	"state" "grill_field_state" DEFAULT 'suggested' NOT NULL,
	"not_applicable" boolean DEFAULT false NOT NULL,
	"na_note" text,
	"source" "grill_field_source" NOT NULL,
	"source_quote" text NOT NULL,
	"source_turn_id" integer,
	"confirmed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "task_field_pk" PRIMARY KEY("task_id","node"),
	CONSTRAINT "task_field_na_note_required" CHECK (NOT "task_field"."not_applicable" OR "task_field"."na_note" IS NOT NULL)
);
--> statement-breakpoint
CREATE TABLE "grill_session" (
	"id" serial PRIMARY KEY NOT NULL,
	"task_id" text NOT NULL,
	"status" "grill_session_status" DEFAULT 'active' NOT NULL,
	"current_node" text,
	"current_block" text,
	"pushbacks" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"skipped_nodes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"questions_asked" integer DEFAULT 0 NOT NULL,
	"version" integer DEFAULT 0 NOT NULL,
	"tags_state" "grill_tags_state" DEFAULT 'suggested' NOT NULL,
	"draft_checkpoint_state" "grill_draft_checkpoint_state" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "grill_session_task_id_unique" UNIQUE("task_id"),
	CONSTRAINT "grill_session_questions_asked_nonnegative" CHECK ("grill_session"."questions_asked" >= 0),
	CONSTRAINT "grill_session_version_nonnegative" CHECK ("grill_session"."version" >= 0)
);
--> statement-breakpoint
CREATE TABLE "grill_turn" (
	"id" serial PRIMARY KEY NOT NULL,
	"session_id" integer NOT NULL,
	"seq" integer NOT NULL,
	"node" text NOT NULL,
	"question" text NOT NULL,
	"options" text[] DEFAULT '{}' NOT NULL,
	"is_pushback" boolean DEFAULT false NOT NULL,
	"answer" text,
	"covered_nodes" text[] DEFAULT '{}' NOT NULL,
	"specificity" text,
	"fallback_used" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "grill_turn_session_seq_unique" UNIQUE("session_id","seq"),
	CONSTRAINT "grill_turn_seq_positive" CHECK ("grill_turn"."seq" > 0)
);
--> statement-breakpoint
CREATE TABLE "proposal" (
	"id" text PRIMARY KEY NOT NULL,
	"task_id" text NOT NULL,
	"team_id" text NOT NULL,
	"solution" text NOT NULL,
	"plan" text NOT NULL,
	"team_roles" text[] NOT NULL,
	"deadline" text NOT NULL,
	"repo_url" text,
	"criteria_answers" jsonb NOT NULL,
	"fit" real NOT NULL,
	"status" text DEFAULT 'submitted' NOT NULL,
	"reject_reason" text,
	"reject_note" text,
	"decided_at" timestamp with time zone,
	"accepted_at" timestamp with time zone,
	"kickoff" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "proposal_fit_range" CHECK ("proposal"."fit" >= 0 and "proposal"."fit" <= 1)
);
--> statement-breakpoint
CREATE TABLE "score_event" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task_id" text NOT NULL,
	"before" integer NOT NULL,
	"after" integer NOT NULL,
	"level_before" text NOT NULL,
	"level_after" text NOT NULL,
	"node" text NOT NULL,
	"place_before" integer NOT NULL,
	"place_after" integer NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stage" (
	"id" text PRIMARY KEY NOT NULL,
	"proposal_id" text NOT NULL,
	"criterion_id" text NOT NULL,
	"criteria_version" integer NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"metric" text NOT NULL,
	"threshold" text NOT NULL,
	"how_to_check" text NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"report_url" text,
	"team_comment" text,
	"business_comment" text,
	"points" integer DEFAULT 0 NOT NULL,
	"claimed_at" timestamp with time zone,
	"confirmed_at" timestamp with time zone,
	CONSTRAINT "stage_points_confirmed" CHECK (("stage"."status" = 'confirmed' and "stage"."points" = 10) or ("stage"."status" <> 'confirmed' and "stage"."points" = 0))
);
--> statement-breakpoint
CREATE TABLE "swipe" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"team_id" text NOT NULL,
	"task_id" text NOT NULL,
	"action" "swipe_action" NOT NULL,
	"block" text,
	"note" text,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "swipe_team_task_action_uq" UNIQUE("team_id","task_id","action")
);
--> statement-breakpoint
CREATE TABLE "task" (
	"id" text PRIMARY KEY NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"legacy_workspace" jsonb,
	"title" text DEFAULT '' NOT NULL,
	"description" text NOT NULL,
	"business_id" text NOT NULL,
	"criteria_version" integer DEFAULT 1 NOT NULL,
	"compensation_note" text,
	"company" text DEFAULT 'Моя компания' NOT NULL,
	"topic" text DEFAULT 'Другое' NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"engagement" text DEFAULT 'practice' NOT NULL,
	"needed_roles" text[] DEFAULT '{}' NOT NULL,
	"needed_skills" text[] DEFAULT '{}' NOT NULL,
	"score" integer DEFAULT 0 NOT NULL,
	"published_at" timestamp with time zone,
	"work_format" text,
	"payment_terms" text,
	"tags_state" text DEFAULT 'suggested' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "team" (
	"id" text PRIMARY KEY NOT NULL,
	"initials" text DEFAULT '' NOT NULL,
	"tagline" text DEFAULT '' NOT NULL,
	"members" integer DEFAULT 3 NOT NULL,
	"color" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"name" text NOT NULL,
	"roles" text[] DEFAULT '{}' NOT NULL,
	"skills" text[] DEFAULT '{}' NOT NULL,
	"technologies" text[] DEFAULT '{}' NOT NULL,
	"interests" text[] DEFAULT '{}' NOT NULL,
	"looking_for" "engagement" DEFAULT 'both' NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ai_logs" ADD CONSTRAINT "ai_logs_task_id_task_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."task"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_logs" ADD CONSTRAINT "ai_logs_turn_id_grill_turn_id_fk" FOREIGN KEY ("turn_id") REFERENCES "public"."grill_turn"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "criterion" ADD CONSTRAINT "criterion_task_id_task_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."task"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "criterion" ADD CONSTRAINT "criterion_source_turn_id_grill_turn_id_fk" FOREIGN KEY ("source_turn_id") REFERENCES "public"."grill_turn"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_field" ADD CONSTRAINT "task_field_task_id_task_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."task"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_field" ADD CONSTRAINT "task_field_source_turn_id_grill_turn_id_fk" FOREIGN KEY ("source_turn_id") REFERENCES "public"."grill_turn"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grill_session" ADD CONSTRAINT "grill_session_task_id_task_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."task"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grill_turn" ADD CONSTRAINT "grill_turn_session_id_grill_session_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."grill_session"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposal" ADD CONSTRAINT "proposal_task_id_task_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."task"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposal" ADD CONSTRAINT "proposal_team_id_team_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."team"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "score_event" ADD CONSTRAINT "score_event_task_id_task_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."task"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stage" ADD CONSTRAINT "stage_proposal_id_proposal_id_fk" FOREIGN KEY ("proposal_id") REFERENCES "public"."proposal"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "swipe" ADD CONSTRAINT "swipe_team_id_team_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."team"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "swipe" ADD CONSTRAINT "swipe_task_id_task_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."task"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task" ADD CONSTRAINT "task_business_id_business_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."business"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "proposal_active_team_task_uq" ON "proposal" USING btree ("task_id","team_id") WHERE "proposal"."status" in ('submitted', 'on_hold', 'accepted');--> statement-breakpoint
CREATE INDEX "proposal_task_idx" ON "proposal" USING btree ("task_id");--> statement-breakpoint
CREATE INDEX "score_event_task_at_idx" ON "score_event" USING btree ("task_id","at" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX "stage_proposal_criterion_uq" ON "stage" USING btree ("proposal_id","criterion_id");--> statement-breakpoint
CREATE INDEX "stage_proposal_idx" ON "stage" USING btree ("proposal_id");
--> statement-breakpoint
-- Preserve original workspace rows before retiring the superseded plural tables.
-- Group-level confirmations and legacy score events are provenance, not ADR-004
-- node confirmations or ADR-005 score history. No criterion is inferred here.
INSERT INTO "business" (id, name, industry, logo_key, created_at)
SELECT id, name, industry, logo_key, created_at FROM businesses;
--> statement-breakpoint
INSERT INTO "team" (id, name, initials, tagline, skills, interests, members, color, created_at, updated_at)
SELECT id, name, initials, tagline, skills, interests, members, color, created_at, updated_at FROM teams;
--> statement-breakpoint
INSERT INTO "task" (id, business_id, title, description, status, version, company, topic, created_at, updated_at, published_at, legacy_workspace)
SELECT t.id, t.business_id, t.title, t.description, t.status::text, t.version,
 b.name, b.industry, t.created_at, t.updated_at, t.published_at,
 jsonb_build_object('schema', 'workspace-v1', 'task', to_jsonb(t),
 'fields', COALESCE((SELECT jsonb_agg(to_jsonb(f)) FROM task_fields f WHERE f.task_id=t.id), '[]'::jsonb),
 'scoreEvents', COALESCE((SELECT jsonb_agg(to_jsonb(e)) FROM score_events e WHERE e.task_id=t.id), '[]'::jsonb),
 'proposals', COALESCE((SELECT jsonb_agg(to_jsonb(p)) FROM proposals p WHERE p.task_id=t.id), '[]'::jsonb),
 'milestones', COALESCE((SELECT jsonb_agg(to_jsonb(m)) FROM milestones m JOIN proposals p ON p.id=m.proposal_id WHERE p.task_id=t.id), '[]'::jsonb))
FROM tasks t JOIN businesses b ON b.id=t.business_id;
--> statement-breakpoint
INSERT INTO task_field (task_id, node, value, state, source, source_quote)
SELECT task_id, CASE node::text WHEN 'context' THEN 'context.current' WHEN 'need' THEN 'context.change' WHEN 'contact' THEN 'link.contact' END,
 value, 'suggested', 'manual', value
FROM task_fields WHERE node::text IN ('context', 'need', 'contact') AND length(btrim(value)) > 0;
--> statement-breakpoint
INSERT INTO grill_session (task_id, status, draft_checkpoint_state)
SELECT id, CASE WHEN status='draft' THEN 'active'::grill_session_status ELSE 'finished'::grill_session_status END, 'pending'
FROM task;
--> statement-breakpoint
-- Legacy proposals have no structured criteria answers or fit inputs. Preserve
-- accepted decisions. Only actual legacy delivery rows become stage snapshots.
INSERT INTO proposal (id, task_id, team_id, solution, plan, team_roles, deadline, repo_url, criteria_answers, fit, status, created_at, updated_at, decided_at, accepted_at)
SELECT id, task_id, team_id, idea, plan, '{}'::text[], timeline, NULLIF(prototype_url,''),
 '{"criteriaVersion":1,"answers":{}}'::jsonb, 0,
 CASE status::text WHEN 'selected' THEN 'accepted' WHEN 'rejected' THEN 'rejected' ELSE 'submitted' END,
 created_at, updated_at, CASE WHEN status::text IN ('selected','rejected') THEN updated_at END,
 CASE WHEN status::text='selected' THEN updated_at END
FROM proposals;
--> statement-breakpoint
UPDATE task SET status='in_work' WHERE EXISTS (SELECT 1 FROM proposal p WHERE p.task_id=task.id AND p.status='accepted');
--> statement-breakpoint
-- Preserve actual legacy delivery evidence and decisions as immutable stage
-- snapshots. These rows do not assert that ADR-004 criteria existed.
INSERT INTO stage (id, proposal_id, criterion_id, criteria_version, position, metric, threshold, how_to_check, status, report_url, team_comment, points, claimed_at, confirmed_at)
SELECT m.id, m.proposal_id, 'legacy:' || m.id, 1, 0, m.title, '',
 'Перенесённый этап workspace-v1; критерий не был структурирован',
 CASE m.status::text WHEN 'confirmed' THEN 'confirmed' ELSE 'claimed' END,
 m.result_url, m.comment, CASE m.status::text WHEN 'confirmed' THEN 10 ELSE 0 END,
 m.submitted_at, m.confirmed_at FROM milestones m;
--> statement-breakpoint
UPDATE proposal p SET kickoff=jsonb_build_object(
 'items', COALESCE((SELECT jsonb_agg(jsonb_build_object('key', f.node::text, 'label', f.node::text, 'value',f.value)) FROM task_fields f WHERE f.task_id=p.task_id AND f.state::text='confirmed'), '[]'::jsonb),
 'firstStage', (SELECT jsonb_build_object('criterionId','legacy:' || m.id,'metric',m.title,'threshold','') FROM milestones m WHERE m.proposal_id=p.id),
 'contact', (SELECT f.value FROM task_fields f WHERE f.task_id=p.task_id AND f.node::text='contact' AND f.state::text='confirmed'),
 'builtAt', p.accepted_at)
WHERE p.status='accepted';
--> statement-breakpoint
DROP TABLE milestones;
--> statement-breakpoint
DROP TABLE proposals;
--> statement-breakpoint
DROP TABLE score_events;
--> statement-breakpoint
DROP TABLE task_fields;
--> statement-breakpoint
DROP TABLE tasks;
--> statement-breakpoint
DROP TABLE teams;
--> statement-breakpoint
DROP TABLE businesses;
--> statement-breakpoint
DROP TYPE milestone_status;
--> statement-breakpoint
DROP TYPE proposal_status;
--> statement-breakpoint
DROP TYPE task_field_node;
--> statement-breakpoint
DROP TYPE task_field_state;
--> statement-breakpoint
DROP TYPE task_status;

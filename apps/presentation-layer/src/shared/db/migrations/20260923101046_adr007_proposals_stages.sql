CREATE TABLE "business" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"industry" text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "criterion" (
	"id" text PRIMARY KEY NOT NULL,
	"task_id" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"metric" text NOT NULL,
	"threshold" text DEFAULT '' NOT NULL,
	"how_to_check" text DEFAULT '' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"confirmed" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "field" (
	"task_id" text NOT NULL,
	"node" text NOT NULL,
	"value" text DEFAULT '' NOT NULL,
	"state" text DEFAULT 'empty' NOT NULL,
	"not_applicable" boolean DEFAULT false NOT NULL
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
CREATE TABLE "task" (
	"id" text PRIMARY KEY NOT NULL,
	"business_id" text NOT NULL,
	"title" text NOT NULL,
	"topic" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"engagement" text DEFAULT 'job' NOT NULL,
	"compensation_note" text,
	"needed_roles" text[] DEFAULT '{}'::text[] NOT NULL,
	"needed_skills" text[] DEFAULT '{}'::text[] NOT NULL,
	"criteria_version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "team" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"roles" text[] DEFAULT '{}'::text[] NOT NULL,
	"skills" text[] DEFAULT '{}'::text[] NOT NULL,
	"technologies" text[] DEFAULT '{}'::text[] NOT NULL,
	"interests" text[] DEFAULT '{}'::text[] NOT NULL
);
--> statement-breakpoint
ALTER TABLE "criterion" ADD CONSTRAINT "criterion_task_id_task_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."task"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "field" ADD CONSTRAINT "field_task_id_task_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."task"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposal" ADD CONSTRAINT "proposal_task_id_task_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."task"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposal" ADD CONSTRAINT "proposal_team_id_team_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."team"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stage" ADD CONSTRAINT "stage_proposal_id_proposal_id_fk" FOREIGN KEY ("proposal_id") REFERENCES "public"."proposal"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task" ADD CONSTRAINT "task_business_id_business_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."business"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "field_task_node_uq" ON "field" USING btree ("task_id","node");--> statement-breakpoint
CREATE UNIQUE INDEX "proposal_active_team_task_uq" ON "proposal" USING btree ("task_id","team_id") WHERE "proposal"."status" in ('submitted', 'on_hold', 'accepted');--> statement-breakpoint
CREATE INDEX "proposal_task_idx" ON "proposal" USING btree ("task_id");--> statement-breakpoint
CREATE UNIQUE INDEX "stage_proposal_criterion_uq" ON "stage" USING btree ("proposal_id","criterion_id");--> statement-breakpoint
CREATE INDEX "stage_proposal_idx" ON "stage" USING btree ("proposal_id");
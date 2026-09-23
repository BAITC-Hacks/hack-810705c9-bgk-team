CREATE TYPE "public"."engagement" AS ENUM('paid', 'practice', 'both');--> statement-breakpoint
CREATE TYPE "public"."swipe_action" AS ENUM('skip', 'missing');--> statement-breakpoint
CREATE TYPE "public"."task_status" AS ENUM('draft', 'published', 'in_work', 'closed');--> statement-breakpoint
CREATE TABLE "swipe" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"team_id" uuid NOT NULL,
	"task_id" uuid NOT NULL,
	"action" "swipe_action" NOT NULL,
	"block" text,
	"note" text,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "swipe_team_task_action_uq" UNIQUE("team_id","task_id","action")
);
--> statement-breakpoint
CREATE TABLE "task" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"company" text NOT NULL,
	"topic" text NOT NULL,
	"status" "task_status" DEFAULT 'draft' NOT NULL,
	"engagement" "engagement" NOT NULL,
	"needed_roles" text[] DEFAULT '{}' NOT NULL,
	"needed_skills" text[] DEFAULT '{}' NOT NULL,
	"score" integer DEFAULT 0 NOT NULL,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "team" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"roles" text[] DEFAULT '{}' NOT NULL,
	"skills" text[] DEFAULT '{}' NOT NULL,
	"technologies" text[] DEFAULT '{}' NOT NULL,
	"interests" text[] DEFAULT '{}' NOT NULL,
	"looking_for" "engagement" NOT NULL,
	CONSTRAINT "team_name_unique" UNIQUE("name")
);
--> statement-breakpoint
ALTER TABLE "swipe" ADD CONSTRAINT "swipe_team_id_team_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."team"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "swipe" ADD CONSTRAINT "swipe_task_id_task_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."task"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "task_status_score_idx" ON "task" USING btree ("status","score");
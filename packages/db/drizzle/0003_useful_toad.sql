CREATE TABLE "ai_dev_session_comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"author_type" varchar(20) NOT NULL,
	"author_id" text,
	"author_name" text,
	"content" text NOT NULL,
	"file_path" text,
	"line_number" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_dev_session_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"level" varchar(20) NOT NULL,
	"phase" varchar(50) NOT NULL,
	"message" text NOT NULL,
	"details" text,
	"progress" integer,
	"timestamp" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_dev_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"issue_source" varchar(50) NOT NULL,
	"issue_id" text NOT NULL,
	"issue_title" text NOT NULL,
	"issue_url" text,
	"issue_severity" varchar(50),
	"application_id" uuid,
	"application_name" text,
	"repository_url" text NOT NULL,
	"branch" varchar(255) DEFAULT 'main' NOT NULL,
	"worktree_id" text,
	"worktree_path" text,
	"agent_type" varchar(50) DEFAULT 'claude' NOT NULL,
	"agent_instance_id" text,
	"status" varchar(50) DEFAULT 'pending' NOT NULL,
	"analysis_result" text,
	"proposed_fix" text,
	"files_changed" text,
	"pr_number" integer,
	"pr_url" text,
	"pr_title" text,
	"pr_status" varchar(50),
	"requires_approval" boolean DEFAULT true NOT NULL,
	"approved_by" text,
	"approved_at" timestamp,
	"rejection_reason" text,
	"tokens_used" integer,
	"cost_estimate" real,
	"error_message" text,
	"retry_count" integer DEFAULT 0 NOT NULL,
	"created_by" text,
	"started_at" timestamp,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ai_dev_session_comments" ADD CONSTRAINT "ai_dev_session_comments_session_id_ai_dev_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."ai_dev_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_dev_session_logs" ADD CONSTRAINT "ai_dev_session_logs_session_id_ai_dev_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."ai_dev_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ai_dev_session_comments_session_id_idx" ON "ai_dev_session_comments" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "ai_dev_session_logs_session_id_idx" ON "ai_dev_session_logs" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "ai_dev_session_logs_timestamp_idx" ON "ai_dev_session_logs" USING btree ("timestamp");--> statement-breakpoint
CREATE INDEX "ai_dev_sessions_issue_source_idx" ON "ai_dev_sessions" USING btree ("issue_source");--> statement-breakpoint
CREATE INDEX "ai_dev_sessions_issue_id_idx" ON "ai_dev_sessions" USING btree ("issue_id");--> statement-breakpoint
CREATE INDEX "ai_dev_sessions_application_idx" ON "ai_dev_sessions" USING btree ("application_id");--> statement-breakpoint
CREATE INDEX "ai_dev_sessions_status_idx" ON "ai_dev_sessions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "ai_dev_sessions_created_at_idx" ON "ai_dev_sessions" USING btree ("created_at");
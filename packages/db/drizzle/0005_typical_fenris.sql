CREATE TABLE "release_assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"release_id" uuid NOT NULL,
	"name" text NOT NULL,
	"content_type" varchar(100),
	"size" integer,
	"download_url" text,
	"github_asset_id" text,
	"gitea_asset_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "releases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_id" uuid NOT NULL,
	"version" varchar(50) NOT NULL,
	"name" text,
	"description" text,
	"changelog" text,
	"status" varchar(50) DEFAULT 'draft' NOT NULL,
	"target_branch" varchar(255) DEFAULT 'main',
	"commit_sha" varchar(255),
	"tag_name" varchar(100),
	"github_release" text,
	"gitea_release" text,
	"deployed_environments" text,
	"is_prerelease" boolean DEFAULT false NOT NULL,
	"created_by" text,
	"published_by" text,
	"published_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "task_activity_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task_id" uuid NOT NULL,
	"action" varchar(50) NOT NULL,
	"field" varchar(50),
	"old_value" text,
	"new_value" text,
	"actor_id" text,
	"actor_name" text,
	"actor_type" varchar(20),
	"source" varchar(50) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "task_comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task_id" uuid NOT NULL,
	"body" text NOT NULL,
	"author_id" text,
	"author_name" text,
	"author_avatar" text,
	"github_comment_id" text,
	"gitea_comment_id" text,
	"linear_comment_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "task_sync_configs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_id" uuid NOT NULL,
	"provider" varchar(50) NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"config" text,
	"sync_direction" varchar(20) DEFAULT 'bidirectional' NOT NULL,
	"auto_sync" boolean DEFAULT true NOT NULL,
	"sync_interval_minutes" integer DEFAULT 15 NOT NULL,
	"last_sync_at" timestamp,
	"last_sync_status" varchar(50),
	"last_sync_error" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"status" varchar(50) DEFAULT 'backlog' NOT NULL,
	"priority" varchar(20),
	"assignee" text,
	"labels" text,
	"due_date" timestamp,
	"estimate" varchar(20),
	"release_id" uuid,
	"github_link" text,
	"gitea_link" text,
	"linear_link" text,
	"notion_link" text,
	"sync_status" varchar(50) DEFAULT 'local_only' NOT NULL,
	"last_sync_at" timestamp,
	"sync_error" text,
	"source_provider" varchar(50),
	"source_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"closed_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "release_assets" ADD CONSTRAINT "release_assets_release_id_releases_id_fk" FOREIGN KEY ("release_id") REFERENCES "public"."releases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "releases" ADD CONSTRAINT "releases_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_activity_log" ADD CONSTRAINT "task_activity_log_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_comments" ADD CONSTRAINT "task_comments_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_sync_configs" ADD CONSTRAINT "task_sync_configs_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "release_assets_release_id_idx" ON "release_assets" USING btree ("release_id");--> statement-breakpoint
CREATE INDEX "releases_application_id_idx" ON "releases" USING btree ("application_id");--> statement-breakpoint
CREATE INDEX "releases_version_idx" ON "releases" USING btree ("version");--> statement-breakpoint
CREATE INDEX "releases_status_idx" ON "releases" USING btree ("status");--> statement-breakpoint
CREATE INDEX "releases_created_at_idx" ON "releases" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "releases_unique_app_version" ON "releases" USING btree ("application_id","version");--> statement-breakpoint
CREATE INDEX "task_activity_log_task_id_idx" ON "task_activity_log" USING btree ("task_id");--> statement-breakpoint
CREATE INDEX "task_activity_log_created_at_idx" ON "task_activity_log" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "task_comments_task_id_idx" ON "task_comments" USING btree ("task_id");--> statement-breakpoint
CREATE INDEX "task_sync_configs_application_id_idx" ON "task_sync_configs" USING btree ("application_id");--> statement-breakpoint
CREATE INDEX "task_sync_configs_provider_idx" ON "task_sync_configs" USING btree ("provider");--> statement-breakpoint
CREATE INDEX "task_sync_configs_unique_app_provider" ON "task_sync_configs" USING btree ("application_id","provider");--> statement-breakpoint
CREATE INDEX "tasks_application_id_idx" ON "tasks" USING btree ("application_id");--> statement-breakpoint
CREATE INDEX "tasks_status_idx" ON "tasks" USING btree ("status");--> statement-breakpoint
CREATE INDEX "tasks_release_id_idx" ON "tasks" USING btree ("release_id");--> statement-breakpoint
CREATE INDEX "tasks_assignee_idx" ON "tasks" USING btree ("assignee");--> statement-breakpoint
CREATE INDEX "tasks_created_at_idx" ON "tasks" USING btree ("created_at");